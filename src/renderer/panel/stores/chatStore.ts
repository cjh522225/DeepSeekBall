import { create } from 'zustand'
import type { Attachment, ChatMessage } from '../../../shared/types'
import { useConvStore } from './convStore'

interface ToastState {
  type: 'info' | 'warn' | 'error'
  message: string
}

interface ChatState {
  conversationId: string | null
  messages: ChatMessage[]
  requestId: string | null
  draft: string
  quote: string
  attachments: Attachment[]
  toast: ToastState | null
  loadConversation: (id: string | null) => Promise<void>
  setDraft: (draft: string) => void
  setQuote: (quote: string) => void
  addAttachment: (attachment: Attachment) => void
  removeAttachment: (id: string) => void
  clearAttachments: () => void
  send: (text: string) => Promise<void>
  regenerate: () => Promise<void>
  stop: () => void
  showToast: (toast: ToastState) => void
  dismissToast: () => void
  handleChunk: (event: { requestId: string; contentDelta?: string; reasoningDelta?: string }) => void
  handleDone: (event: { requestId: string; message: ChatMessage }) => void
  handleError: (event: { requestId: string; error: string }) => void
}

let toastTimer: ReturnType<typeof setTimeout> | null = null

export const useChatStore = create<ChatState>((set, get) => ({
  conversationId: null,
  messages: [],
  requestId: null,
  draft: '',
  quote: '',
  attachments: [],
  toast: null,

  loadConversation: async (id) => {
    if (!id) {
      set({ conversationId: null, messages: [], requestId: null })
      return
    }
    const conversation = await window.api.conv.get(id)
    set({
      conversationId: id,
      messages: conversation?.messages ?? [],
      requestId: null,
      quote: '',
      attachments: [],
      draft: ''
    })
  },

  setDraft: (draft) => set({ draft }),
  setQuote: (quote) => set({ quote }),
  addAttachment: (attachment) =>
    set((state) => ({ attachments: [...state.attachments, attachment] })),
  removeAttachment: (id) =>
    set((state) => ({ attachments: state.attachments.filter((a) => a.id !== id) })),
  clearAttachments: () => set({ attachments: [] }),

  send: async (text) => {
    const state = get()
    const quote = state.quote.trim()
    const body = quote ? `> ${quote.replace(/\n/g, '\n> ')}\n\n${text}` : text
    if (!body.trim() && state.attachments.length === 0) return
    let conversationId = state.conversationId
    if (!conversationId || !useConvStore.getState().list.some((c) => c.id === conversationId)) {
      const meta = await useConvStore.getState().create()
      conversationId = meta.id
      set({ conversationId: meta.id, messages: [] })
    }
    const requestId = crypto.randomUUID()
    const attachments = state.attachments.length ? [...state.attachments] : undefined
    const userMessage: ChatMessage = {
      id: `local-user-${requestId}`,
      role: 'user',
      content: body,
      status: 'done',
      attachments,
      createdAt: Date.now()
    }
    const assistantMessage: ChatMessage = {
      id: `local-assistant-${requestId}`,
      role: 'assistant',
      content: '',
      status: 'streaming',
      createdAt: Date.now()
    }
    set((prev) => ({
      messages: [...prev.messages, userMessage, assistantMessage],
      requestId,
      draft: '',
      quote: '',
      attachments: []
    }))
    await window.api.chat.send({ conversationId, text: body, attachments, requestId })
  },

  regenerate: async () => {
    const state = get()
    const conversationId = state.conversationId
    if (!conversationId || state.requestId) return
    const messages = [...state.messages]
    while (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
      messages.pop()
    }
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    if (!lastUser) return
    const requestId = crypto.randomUUID()
    const assistantMessage: ChatMessage = {
      id: `local-assistant-${requestId}`,
      role: 'assistant',
      content: '',
      status: 'streaming',
      createdAt: Date.now()
    }
    set({ messages: [...messages, assistantMessage], requestId })
    await window.api.chat.send({
      conversationId,
      text: lastUser.content,
      attachments: lastUser.attachments,
      requestId,
      regenerate: true
    })
  },

  stop: () => {
    const { requestId } = get()
    if (requestId) window.api.chat.stop(requestId)
  },

  showToast: (toast) => {
    if (toastTimer) clearTimeout(toastTimer)
    set({ toast })
    toastTimer = setTimeout(() => set({ toast: null }), 3600)
  },

  dismissToast: () => set({ toast: null }),

  handleChunk: (event) =>
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === `local-assistant-${event.requestId}`
          ? {
              ...message,
              content: message.content + (event.contentDelta ?? ''),
              reasoning: (message.reasoning ?? '') + (event.reasoningDelta ?? '')
            }
          : message
      )
    })),

  handleDone: (event) => {
    set((state) => {
      const targetId = `local-assistant-${event.requestId}`
      const final = event.message
      if (final.status === 'aborted' && !final.content) {
        return {
          requestId: null,
          messages: state.messages.filter((m) => m.id !== targetId)
        }
      }
      return {
        requestId: null,
        messages: state.messages.map((m) => (m.id === targetId ? final : m))
      }
    })
    void useConvStore.getState().load()
  },

  handleError: (event) => {
    set((state) => ({
      requestId: null,
      messages: state.messages.map((message) =>
        message.id === `local-assistant-${event.requestId}`
          ? { ...message, status: 'error', error: event.error, content: message.content }
          : message
      )
    }))
    get().showToast({ type: 'error', message: event.error })
    void useConvStore.getState().load()
  }
}))
