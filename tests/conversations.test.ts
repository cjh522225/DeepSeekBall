import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { ChatMessage } from '../src/shared/types'

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dsball-conv-'))

vi.mock('electron', () => ({
  app: {
    getPath: () => tmpRoot,
    setPath: () => undefined
  }
}))

let store: typeof import('../src/main/store/conversations')

function message(role: ChatMessage['role'], content: string): ChatMessage {
  return { id: Math.random().toString(36).slice(2), role, content, status: 'done', createdAt: Date.now() }
}

beforeAll(async () => {
  store = await import('../src/main/store/conversations')
})

describe('conversations store', () => {
  it('creates and lists conversations sorted by updatedAt', () => {
    const a = store.createConversation()
    const b = store.createConversation()
    const list = store.listConversations()
    expect(list.map((c) => c.id)).toContain(a.id)
    expect(list.map((c) => c.id)).toContain(b.id)
    expect(list[0].updatedAt).toBeGreaterThanOrEqual(list[1].updatedAt)
  })

  it('appends messages and derives the title from the first user message', () => {
    const conv = store.createConversation()
    store.appendMessage(conv.id, message('user', '帮我解释一下快速排序\n第二行忽略'), '帮我解释一下快速排序')
    const loaded = store.getConversation(conv.id)
    expect(loaded?.messages).toHaveLength(1)
    expect(loaded?.title).toBe('帮我解释一下快速排序')
    expect(store.listConversations().find((c) => c.id === conv.id)?.messageCount).toBe(1)
  })

  it('updates and renames messages', () => {
    const conv = store.createConversation()
    const msg = message('assistant', 'partial')
    store.appendMessage(conv.id, msg)
    store.updateMessage(conv.id, msg.id, { content: 'final', status: 'done' })
    expect(store.getConversation(conv.id)?.messages[0].content).toBe('final')
    store.renameConversation(conv.id, '新标题')
    expect(store.getConversation(conv.id)?.title).toBe('新标题')
    expect(store.listConversations().find((c) => c.id === conv.id)?.title).toBe('新标题')
  })

  it('trims trailing assistant messages for regeneration', () => {
    const conv = store.createConversation()
    store.appendMessage(conv.id, message('user', 'hi'))
    store.appendMessage(conv.id, message('assistant', 'a1'))
    store.appendMessage(conv.id, message('assistant', 'a2'))
    store.trimTrailingAssistant(conv.id)
    const loaded = store.getConversation(conv.id)
    expect(loaded?.messages).toHaveLength(1)
    expect(loaded?.messages[0].role).toBe('user')
  })

  it('searches by title and by message content', () => {
    const conv = store.createConversation()
    store.appendMessage(conv.id, message('user', '关于量子纠缠的解释'), '关于量子纠缠的解释')
    expect(store.searchConversations('量子纠缠').map((c) => c.id)).toContain(conv.id)
    store.renameConversation(conv.id, '物理学问题')
    expect(store.searchConversations('物理学').map((c) => c.id)).toContain(conv.id)
    expect(store.searchConversations('不存在的关键词')).toHaveLength(0)
  })

  it('exports a conversation as markdown', () => {
    const conv = store.createConversation()
    store.appendMessage(conv.id, message('user', '你好'))
    store.appendMessage(conv.id, {
      ...message('assistant', '你好！有什么可以帮你？'),
      reasoning: '思考中'
    })
    const md = store.exportConversationMarkdown(conv.id)
    expect(md).toContain('## 我')
    expect(md).toContain('## AI')
    expect(md).toContain('思考过程')
  })

  it('deletes conversations and keeps the index consistent', () => {
    const conv = store.createConversation()
    expect(store.deleteConversation(conv.id)).toBe(true)
    expect(store.getConversation(conv.id)).toBeNull()
    expect(store.listConversations().some((c) => c.id === conv.id)).toBe(false)
    expect(store.deleteConversation('missing-id')).toBe(false)
  })

  it('exports all conversations as json', () => {
    const payload = JSON.parse(store.exportAllJson()) as {
      conversations: unknown[]
    }
    expect(Array.isArray(payload.conversations)).toBe(true)
  })
})
