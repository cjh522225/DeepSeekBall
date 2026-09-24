import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { RendererApi, Unsubscribe } from '../shared/api'
import type {
  Attachment,
  CaptureInitPayload,
  CaptureSubmitPayload,
  ChatSendPayload,
  McpCallToolPayload,
  McpServerConfig,
  McpServerStatus,
  McpToolInfo,
  SettingsPatch,
  StreamChunkEvent,
  StreamDoneEvent,
  StreamErrorEvent,
  ToolCallEvent,
  ToolConfirmRequestEvent,
  ToolConfirmResponsePayload
} from '../shared/types'

function on<T>(channel: string, cb: (payload: T) => void): Unsubscribe {
  const listener = (_event: IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: RendererApi = {
  ball: {
    dragStart: () => ipcRenderer.send('ball:drag-start'),
    dragEnd: () => ipcRenderer.send('ball:drag-end'),
    click: () => ipcRenderer.send('ball:click'),
    contextMenu: () => ipcRenderer.send('ball:context-menu'),
    onStreaming: (cb) => on<boolean>('app:streaming', cb),
    onAppearance: (cb) => on<void>('ball:appearance', () => cb())
  },
  panel: {
    hide: () => ipcRenderer.send('panel:hide'),
    onShow: (cb) => on<void>('panel:show', () => cb()),
    onCollapseRequest: (cb) => on<void>('panel:collapse-request', () => cb())
  },
  conv: {
    list: () => ipcRenderer.invoke('conv:list'),
    create: (title?: string) => ipcRenderer.invoke('conv:create', title),
    get: (id: string) => ipcRenderer.invoke('conv:get', id),
    rename: (id: string, title: string) => ipcRenderer.invoke('conv:rename', id, title),
    remove: (id: string) => ipcRenderer.invoke('conv:remove', id),
    search: (query: string) => ipcRenderer.invoke('conv:search', query),
    exportMd: (id: string) => ipcRenderer.invoke('conv:export-md', id),
    exportAll: () => ipcRenderer.invoke('conv:export-all')
  },
  chat: {
    send: (payload: ChatSendPayload) => ipcRenderer.invoke('chat:send', payload),
    stop: (requestId: string) => ipcRenderer.send('chat:stop', requestId),
    respondToolConfirm: (payload: ToolConfirmResponsePayload) =>
      ipcRenderer.send('chat:toolConfirmResponse', payload),
    onChunk: (cb) => on<StreamChunkEvent>('chat:chunk', cb),
    onDone: (cb) => on<StreamDoneEvent>('chat:done', cb),
    onError: (cb) => on<StreamErrorEvent>('chat:error', cb),
    onToolCall: (cb) => on<ToolCallEvent>('chat:tool-call', cb),
    onToolConfirmRequest: (cb) => on<ToolConfirmRequestEvent>('chat:toolConfirmRequest', cb)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch: SettingsPatch) => ipcRenderer.invoke('settings:set', patch),
    test: () => ipcRenderer.invoke('settings:test'),
    listModels: () => ipcRenderer.invoke('settings:list-models'),
    importOpenCodeKey: () => ipcRenderer.invoke('settings:import-opencode-key'),
    webLogin: () => ipcRenderer.invoke('settings:web-login'),
    webLogout: () => ipcRenderer.invoke('settings:web-logout'),
    onTheme: (cb) => on<boolean>('theme:changed', cb)
  },
  capture: {
    start: () => ipcRenderer.send('capture:start'),
    submit: (payload: CaptureSubmitPayload) => ipcRenderer.send('capture:submit', payload),
    cancel: () => ipcRenderer.send('capture:cancel'),
    onInit: (cb) => on<CaptureInitPayload>('capture:init', cb)
  },
  composer: {
    onInsert: (cb) => on('composer:insert', cb),
    onToast: (cb) => on('toast', cb),
    onMenu: (cb) => on('menu', cb)
  },
  attach: {
    saveBuffer: (bytes: Uint8Array, mime: string) =>
      ipcRenderer.invoke('attach:save-buffer', { bytes, mime }) as Promise<Attachment | null>
  },
  ocr: {
    run: (filePath: string) => ipcRenderer.invoke('ocr:run', filePath)
  },
  mcp: {
    listServers: () => ipcRenderer.invoke('mcp:list-servers') as Promise<McpServerConfig[]>,
    listStatuses: () => ipcRenderer.invoke('mcp:list-statuses') as Promise<McpServerStatus[]>,
    upsertServer: (config: McpServerConfig) =>
      ipcRenderer.invoke('mcp:upsert-server', config) as Promise<McpServerConfig[]>,
    removeServer: (id: string) =>
      ipcRenderer.invoke('mcp:remove-server', id) as Promise<McpServerConfig[]>,
    testConnection: (config: McpServerConfig) =>
      ipcRenderer.invoke('mcp:test-connection', config) as Promise<{
        ok: boolean
        message: string
        tools: McpToolInfo[]
      }>,
    listTools: (serverId?: string) =>
      ipcRenderer.invoke('mcp:list-tools', serverId) as Promise<McpToolInfo[]>,
    callTool: (payload: McpCallToolPayload) =>
      ipcRenderer.invoke('mcp:call-tool', payload) as Promise<{ ok: boolean; text: string }>,
    refresh: () => ipcRenderer.invoke('mcp:refresh') as Promise<McpServerStatus[]>,
    onStatus: (cb) => on<McpServerStatus>('mcp:status', cb),
    onTools: (cb) => on<{ serverId: string; tools: McpToolInfo[] }>('mcp:tools', cb)
  },
  app: {
    openDataDir: () => ipcRenderer.send('app:open-data-dir'),
    setAutoLaunch: (enabled: boolean) => ipcRenderer.invoke('app:set-auto-launch', enabled),
    version: () => ipcRenderer.invoke('app:version')
  }
}

contextBridge.exposeInMainWorld('api', api)
