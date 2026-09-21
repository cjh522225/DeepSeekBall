import { create } from 'zustand'
import type { ConversationMeta } from '../../../shared/types'

interface ConvState {
  list: ConversationMeta[]
  currentId: string | null
  query: string
  results: ConversationMeta[] | null
  load: () => Promise<void>
  select: (id: string) => Promise<void>
  create: () => Promise<ConversationMeta>
  remove: (id: string) => Promise<void>
  rename: (id: string, title: string) => Promise<void>
  search: (query: string) => Promise<void>
  setCurrent: (id: string | null) => void
}

export const useConvStore = create<ConvState>((set, get) => ({
  list: [],
  currentId: null,
  query: '',
  results: null,
  load: async () => {
    const list = await window.api.conv.list()
    set({ list })
    const { currentId } = get()
    if (!currentId && list.length > 0) set({ currentId: list[0].id })
  },
  select: async (id) => {
    set({ currentId: id, query: '', results: null })
    const { useChatStore } = await import('./chatStore')
    await useChatStore.getState().loadConversation(id)
  },
  create: async () => {
    const meta = await window.api.conv.create()
    const list = await window.api.conv.list()
    set({ list, currentId: meta.id, query: '', results: null })
    return meta
  },
  remove: async (id) => {
    await window.api.conv.remove(id)
    const list = await window.api.conv.list()
    let currentId = get().currentId
    if (currentId === id) currentId = list[0]?.id ?? null
    set({ list, currentId })
  },
  rename: async (id, title) => {
    await window.api.conv.rename(id, title)
    set({ list: await window.api.conv.list() })
  },
  search: async (query) => {
    set({ query })
    if (!query.trim()) {
      set({ results: null })
      return
    }
    set({ results: await window.api.conv.search(query) })
  },
  setCurrent: (id) => set({ currentId: id })
}))
