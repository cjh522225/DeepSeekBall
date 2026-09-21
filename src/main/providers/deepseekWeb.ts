import path from 'node:path'
import { createHash } from 'node:crypto'
import { BrowserWindow } from 'electron'
import { loadSettings } from '../config'
import type { ChatMessage } from '../../shared/types'
import type { ChatProvider, ProviderContext } from './types'

const ORIGIN = 'https://chat.deepseek.com'
const PARTITION = 'persist:deepseek-web'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

let webWindow: BrowserWindow | null = null
let pageReady = false

function ensureWindow(): BrowserWindow {
  if (webWindow && !webWindow.isDestroyed()) return webWindow
  pageReady = false
  webWindow = new BrowserWindow({
    width: 560,
    height: 760,
    show: false,
    title: '登录 DeepSeek（实验性网页模式）',
    autoHideMenuBar: true,
    webPreferences: {
      partition: PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  webWindow.webContents.on('did-finish-load', () => {
    pageReady = true
  })
  webWindow.on('closed', () => {
    webWindow = null
    pageReady = false
  })
  void webWindow.loadURL(`${ORIGIN}/`)
  return webWindow
}

function waitForReady(win: BrowserWindow, timeoutMs: number): Promise<void> {
  if (pageReady || win.isDestroyed()) return Promise.resolve()
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      win.webContents.removeListener('did-finish-load', onLoad)
      resolve()
    }, timeoutMs)
    function onLoad(): void {
      clearTimeout(timer)
      resolve()
    }
    win.webContents.once('did-finish-load', onLoad)
  })
}

export function openLoginWindow(): void {
  const win = ensureWindow()
  win.show()
  win.focus()
}

export function closeLoginWindow(): void {
  if (webWindow && !webWindow.isDestroyed()) webWindow.close()
  webWindow = null
  pageReady = false
}

async function readToken(win: BrowserWindow): Promise<string> {
  const raw = (await win.webContents.executeJavaScript(
    `(() => { try { const v = window.localStorage.getItem('userToken'); return typeof v === 'string' ? v : '' } catch { return '' } })()`,
    true
  )) as string
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw) as { value?: unknown } | string | null
    if (typeof parsed === 'string') return parsed
    if (parsed && typeof parsed === 'object' && typeof parsed.value === 'string') {
      return parsed.value
    }
    return ''
  } catch {
    return raw
  }
}

async function getUserToken(): Promise<string> {
  const win = ensureWindow()
  if (!pageReady) await waitForReady(win, 10_000)
  if (win.isDestroyed()) return ''
  return readToken(win)
}

export async function checkWebLogin(): Promise<boolean> {
  try {
    const settings = loadSettings()
    if (!webWindow && settings.provider !== 'web') return false
    const token = await getUserToken()
    return token.length > 0
  } catch {
    return false
  }
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

export function solvePow(challenge: string, salt: string, difficulty: number): string {
  let answer = sha256Hex(`${challenge}${salt}`)
  for (let i = 0; i < difficulty; i += 1) {
    answer = sha256Hex(`${answer}${salt}`)
  }
  return answer
}

interface PowChallenge {
  algorithm: string
  challenge: string
  salt: string
  difficulty: number
  signature: string
  target_path: string
}

async function createPowHeader(token: string, targetPath: string): Promise<string> {
  const response = await fetch(`${ORIGIN}/api/v0/chat/create_pow_challenge`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'user-agent': UA,
      origin: ORIGIN,
      referer: `${ORIGIN}/`
    },
    body: JSON.stringify({ target_path: targetPath })
  })
  const body = (await response.json()) as {
    data?: { biz_data?: { challenge?: PowChallenge } }
    msg?: string
  }
  if (!response.ok || !body?.data?.biz_data?.challenge) {
    throw new Error(`获取 PoW 挑战失败：${body?.msg ?? response.status}`)
  }
  const challenge = body.data.biz_data.challenge
  const answer = solvePow(challenge.challenge, challenge.salt, challenge.difficulty)
  return Buffer.from(
    JSON.stringify({
      algorithm: challenge.algorithm,
      challenge: challenge.challenge,
      salt: challenge.salt,
      answer,
      signature: challenge.signature,
      target_path: challenge.target_path
    }),
    'utf8'
  ).toString('base64')
}

function toWebPrompt(messages: ChatMessage[], systemPrompt: string): string {
  const usable = messages.filter((m) => m.role !== 'system' && m.status !== 'error')
  if (usable.length <= 1) {
    const last = usable[usable.length - 1]
    const content = systemPrompt.trim()
      ? `${systemPrompt.trim()}\n\n${last?.content ?? ''}`
      : last?.content ?? ''
    return content
  }
  return usable
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n')
}

function handleEvent(event: Record<string, unknown>, ctx: ProviderContext): void {
  const data = (event.data ?? event) as Record<string, unknown>
  const response = data.response as Record<string, unknown> | undefined
  if (response?.message_id) {
    ctx.onWebState?.({
      sessionId: String(response.chat_session_id ?? ''),
      parentMessageId: String(response.message_id)
    })
  }
  const pathKey = String(data.p ?? '')
  const op = String(data.o ?? '')
  const value = data.v
  if (typeof value === 'string' && op !== 'REMOVE') {
    if (pathKey.includes('thinking')) ctx.onChunk({ reasoningDelta: value })
    else if (pathKey === '' || pathKey.includes('content')) ctx.onChunk({ contentDelta: value })
  }
  const error = data.error ?? event.error
  if (error) {
    const message =
      typeof error === 'string'
        ? error
        : String((error as Record<string, unknown>).message ?? '网页模式返回错误')
    throw new Error(message)
  }
}

async function requestCompletion(
  token: string,
  body: Record<string, unknown>,
  ctx: ProviderContext
): Promise<void> {
  const powHeader = await createPowHeader(token, '/api/v0/chat/completion')
  const response = await fetch(`${ORIGIN}/api/v0/chat/completion`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'x-ds-pow-response': powHeader,
      'user-agent': UA,
      origin: ORIGIN,
      referer: `${ORIGIN}/`
    },
    body: JSON.stringify(body),
    signal: ctx.signal
  })
  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '')
    throw new Error(`网页接口请求失败：HTTP ${response.status} ${text.slice(0, 160)}`)
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      let event: Record<string, unknown>
      try {
        event = JSON.parse(payload) as Record<string, unknown>
      } catch {
        continue
      }
      handleEvent(event, ctx)
    }
  }
}

export const deepseekWebProvider: ChatProvider = {
  async stream(ctx: ProviderContext): Promise<void> {
    const token = await getUserToken()
    if (!token) throw new Error('未登录 DeepSeek 网页账号，请先在设置中点击「登录网页账号」')
    const thinking = /reason/i.test(ctx.settings.model)
    const continuing = Boolean(ctx.web?.sessionId)
    const latestUser = [...ctx.messages].reverse().find((m) => m.role === 'user')
    const prompt = continuing
      ? latestUser?.content ?? ''
      : toWebPrompt(ctx.messages, ctx.settings.systemPrompt)
    if (!prompt.trim()) throw new Error('没有可发送的内容')
    const body: Record<string, unknown> = {
      chat_session_id: continuing ? ctx.web?.sessionId : null,
      parent_message_id: continuing ? ctx.web?.parentMessageId ?? null : null,
      model_type: null,
      prompt,
      ref_file_ids: [],
      thinking_enabled: thinking,
      search_enabled: false,
      client_ready_at: Date.now()
    }
    await requestCompletion(token, body, ctx)
  }
}

export function webAccountStoragePath(): string {
  return path.join('partitions', PARTITION.replace(':', '_'))
}
