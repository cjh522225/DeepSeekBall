import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import OpenAI from 'openai'
import type { ChatMessage, Settings } from '../../shared/types'
import type { ChatProvider, ProviderContext } from './types'

export const OPENCODE_CLIENT = 'deepseek-ball/0.1.0'

export function isOpenCodeGo(settings: Settings): boolean {
  return /opencode\.ai/i.test(settings.baseUrl)
}

export function buildRequestHeaders(
  settings: Settings,
  sessionId?: string
): Record<string, string> {
  if (!isOpenCodeGo(settings)) return {}
  return {
    'x-opencode-client': OPENCODE_CLIENT,
    'x-opencode-session': sessionId?.trim() || randomUUID(),
    'x-opencode-request': randomUUID()
  }
}

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif'
}

type ApiContent = string | Array<Record<string, unknown>>

function toApiContent(message: ChatMessage, vision: boolean): ApiContent {
  if (message.role !== 'user' || !vision || !message.attachments?.length) return message.content
  const parts: Array<Record<string, unknown>> = []
  for (const attachment of message.attachments) {
    try {
      const data = fs.readFileSync(attachment.filePath).toString('base64')
      const mime = MIME_BY_EXT[path.extname(attachment.filePath).toLowerCase()] ?? 'image/png'
      parts.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${data}` } })
    } catch {
      void 0
    }
  }
  parts.push({ type: 'text', text: message.content })
  return parts
}

export function buildApiMessages(settings: Settings, messages: ChatMessage[]): unknown[] {
  const usable = messages.filter(
    (m) =>
      m.role !== 'system' &&
      m.status !== 'error' &&
      (m.content.trim().length > 0 || (m.attachments?.length ?? 0) > 0)
  )
  const context = usable.slice(-Math.max(1, settings.maxContextMessages))
  const result: Array<Record<string, unknown>> = []
  if (settings.systemPrompt.trim()) {
    result.push({ role: 'system', content: settings.systemPrompt.trim() })
  }
  for (const message of context) {
    result.push({
      role: message.role,
      content: toApiContent(message, settings.imageHandling === 'vision')
    })
  }
  return result
}

function createClient(settings: Settings, apiKey: string, timeout: number): OpenAI {
  if (!apiKey.trim()) throw new Error('未配置 API Key，请在设置中填写')
  return new OpenAI({
    apiKey: apiKey.trim(),
    baseURL: settings.baseUrl.trim().replace(/\/+$/, ''),
    timeout,
    maxRetries: 1
  })
}

export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  const cause = (error as { cause?: unknown }).cause
  const causeText =
    cause instanceof Error
      ? cause.message
      : cause && typeof cause === 'object'
        ? JSON.stringify(cause).slice(0, 200)
        : ''
  return causeText ? `${error.message}（${causeText}）` : error.message
}

export const openAICompatibleProvider: ChatProvider = {
  async stream(ctx: ProviderContext): Promise<void> {
    const client = createClient(ctx.settings, ctx.apiKey, 180_000)
    try {
      const stream = await client.chat.completions.create(
        {
          model: ctx.settings.model,
          messages: buildApiMessages(ctx.settings, ctx.messages) as never,
          temperature: ctx.settings.temperature,
          stream: true
        },
        {
          signal: ctx.signal,
          headers: buildRequestHeaders(ctx.settings, ctx.sessionId)
        }
      )
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta as
          | { content?: string; reasoning_content?: string }
          | undefined
        if (!delta) continue
        if (delta.reasoning_content) ctx.onChunk({ reasoningDelta: delta.reasoning_content })
        if (delta.content) ctx.onChunk({ contentDelta: delta.content })
      }
    } catch (error) {
      if (ctx.signal.aborted) throw error
      throw new Error(describeError(error))
    }
  }
}

export async function testConnection(
  settings: Settings,
  apiKey: string
): Promise<{ ok: boolean; message: string }> {
  try {
    const client = createClient(settings, apiKey, 20_000)
    const models = await client.models.list()
    const count = models.data?.length ?? 0
    return { ok: true, message: `连接成功，可用模型 ${count} 个` }
  } catch (error) {
    return { ok: false, message: describeError(error) }
  }
}

export async function listModels(
  settings: Settings,
  apiKey: string
): Promise<{ ok: boolean; models: string[]; message?: string }> {
  try {
    const client = createClient(settings, apiKey, 20_000)
    const models = await client.models.list()
    return { ok: true, models: (models.data ?? []).map((m) => m.id) }
  } catch (error) {
    return { ok: false, models: [], message: describeError(error) }
  }
}
