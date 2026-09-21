import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { subDir } from '../appPaths'
import type { ChatMessage, Conversation, ConversationMeta } from '../../shared/types'

const DEFAULT_TITLE = '新会话'

let indexCache: ConversationMeta[] | null = null

const convDir = (): string => subDir('conversations')
const convPath = (id: string): string => path.join(convDir(), `${id}.json`)
const indexPath = (): string => path.join(convDir(), 'index.json')

function readJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
  } catch {
    return fallback
  }
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  const tmp = `${filePath}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8')
  fs.renameSync(tmp, filePath)
}

function loadIndex(): ConversationMeta[] {
  if (indexCache) return indexCache
  indexCache = readJson<ConversationMeta[]>(indexPath(), [])
  return indexCache
}

function saveIndex(): void {
  writeJsonAtomic(indexPath(), loadIndex())
}

function findMeta(id: string): ConversationMeta | undefined {
  return loadIndex().find((c) => c.id === id)
}

export function listConversations(): ConversationMeta[] {
  return [...loadIndex()].sort((a, b) => b.updatedAt - a.updatedAt)
}

export function createConversation(title = DEFAULT_TITLE): ConversationMeta {
  const now = Date.now()
  const meta: ConversationMeta = {
    id: randomUUID(),
    title,
    createdAt: now,
    updatedAt: now,
    messageCount: 0
  }
  const conv: Conversation = { ...meta, messages: [] }
  writeJsonAtomic(convPath(meta.id), conv)
  loadIndex().push(meta)
  saveIndex()
  return meta
}

export function getConversation(id: string): Conversation | null {
  const conv = readJson<Conversation | null>(convPath(id), null)
  if (!conv) return null
  conv.messages = conv.messages ?? []
  return conv
}

function saveConversation(conv: Conversation): void {
  writeJsonAtomic(convPath(conv.id), conv)
}

export function appendMessage(
  id: string,
  message: ChatMessage,
  titleHint?: string
): ConversationMeta | null {
  const conv = getConversation(id)
  if (!conv) return null
  conv.messages.push(message)
  conv.messageCount = conv.messages.length
  conv.updatedAt = message.createdAt
  if (
    titleHint &&
    conv.title === DEFAULT_TITLE &&
    conv.messages.filter((m) => m.role === 'user').length === 1
  ) {
    conv.title = titleHint.slice(0, 30)
  }
  saveConversation(conv)
  const meta = findMeta(id)
  if (meta) {
    meta.updatedAt = conv.updatedAt
    meta.messageCount = conv.messageCount
    meta.title = conv.title
    saveIndex()
  }
  return meta ?? null
}

export function updateMessage(id: string, messageId: string, patch: Partial<ChatMessage>): void {
  const conv = getConversation(id)
  if (!conv) return
  const target = conv.messages.find((m) => m.id === messageId)
  if (!target) return
  Object.assign(target, patch)
  conv.updatedAt = Date.now()
  saveConversation(conv)
}

export function trimTrailingAssistant(id: string): void {
  const conv = getConversation(id)
  if (!conv) return
  while (conv.messages.length > 0) {
    const last = conv.messages[conv.messages.length - 1]
    if (last.role !== 'assistant') break
    conv.messages.pop()
  }
  conv.messageCount = conv.messages.length
  saveConversation(conv)
  const meta = findMeta(id)
  if (meta) {
    meta.messageCount = conv.messageCount
    saveIndex()
  }
}

export function setConversationWebState(
  id: string,
  sessionId: string,
  parentMessageId: string | null
): void {
  const conv = getConversation(id)
  if (!conv) return
  conv.webSessionId = sessionId
  conv.webParentMessageId = parentMessageId
  const meta = findMeta(id)
  if (meta) {
    meta.webSessionId = sessionId
    meta.webParentMessageId = parentMessageId
    saveIndex()
  }
}

export function renameConversation(id: string, title: string): boolean {
  const conv = getConversation(id)
  const meta = findMeta(id)
  if (!conv || !meta) return false
  conv.title = title.trim() || DEFAULT_TITLE
  meta.title = conv.title
  saveConversation(conv)
  saveIndex()
  return true
}

export function deleteConversation(id: string): boolean {
  const idx = loadIndex()
  const pos = idx.findIndex((c) => c.id === id)
  if (pos === -1) return false
  idx.splice(pos, 1)
  saveIndex()
  try {
    fs.rmSync(convPath(id), { force: true })
  } catch {
    void 0
  }
  return true
}

export function searchConversations(query: string): ConversationMeta[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const hits: ConversationMeta[] = []
  for (const meta of loadIndex()) {
    if (meta.title.toLowerCase().includes(q)) {
      hits.push(meta)
      continue
    }
    const conv = getConversation(meta.id)
    if (conv?.messages.some((m) => m.content.toLowerCase().includes(q))) hits.push(meta)
  }
  return hits.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 50)
}

export function exportConversationMarkdown(id: string): string {
  const conv = getConversation(id)
  if (!conv) return ''
  const lines: string[] = [`# ${conv.title}`, '']
  for (const m of conv.messages) {
    const who = m.role === 'user' ? '我' : 'AI'
    lines.push(`## ${who}`, '')
    if (m.reasoning) {
      lines.push('<details><summary>思考过程</summary>', '', m.reasoning, '', '</details>', '')
    }
    lines.push(m.content, '')
  }
  return lines.join('\n')
}

export function exportAllJson(): string {
  const payload = loadIndex().map((meta) => getConversation(meta.id)).filter(Boolean)
  return JSON.stringify({ app: 'DeepSeekBall', exportedAt: Date.now(), conversations: payload }, null, 2)
}

export function clearAll(): void {
  for (const meta of loadIndex()) {
    try {
      fs.rmSync(convPath(meta.id), { force: true })
    } catch {
      void 0
    }
  }
  indexCache = []
  saveIndex()
}
