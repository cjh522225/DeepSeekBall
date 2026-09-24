import { create } from 'zustand'
import type { McpServerConfig, McpServerStatus, McpToolInfo } from '../../../shared/types'

interface McpState {
  servers: McpServerConfig[]
  statuses: Record<string, McpServerStatus>
  load: () => Promise<void>
  upsert: (config: McpServerConfig) => Promise<void>
  remove: (id: string) => Promise<void>
  refresh: () => Promise<void>
  setStatus: (status: McpServerStatus) => void
  setTools: (serverId: string, tools: McpToolInfo[]) => void
}

export const useMcpStore = create<McpState>((set) => ({
  servers: [],
  statuses: {},

  load: async () => {
    const [servers, statuses] = await Promise.all([
      window.api.mcp.listServers(),
      window.api.mcp.listStatuses()
    ])
    set({
      servers,
      statuses: Object.fromEntries(statuses.map((status) => [status.id, status]))
    })
  },

  upsert: async (config) => {
    const servers = await window.api.mcp.upsertServer(config)
    set({ servers })
  },

  remove: async (id) => {
    const servers = await window.api.mcp.removeServer(id)
    set((state) => {
      const statuses = { ...state.statuses }
      delete statuses[id]
      return { servers, statuses }
    })
  },

  refresh: async () => {
    const statuses = await window.api.mcp.refresh()
    set((state) => {
      const next = { ...state.statuses }
      for (const status of statuses) next[status.id] = status
      return { statuses: next }
    })
  },

  setStatus: (status) => set((state) => ({ statuses: { ...state.statuses, [status.id]: status } })),

  setTools: (serverId, tools) =>
    set((state) => {
      const current = state.statuses[serverId]
      if (!current) return {}
      return { statuses: { ...state.statuses, [serverId]: { ...current, tools } } }
    })
}))
