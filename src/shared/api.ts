import type {
  Attachment,
  CaptureInitPayload,
  CaptureSubmitPayload,
  ChatSendPayload,
  Conversation,
  ConversationMeta,
  PublicSettings,
  SettingsPatch,
  StreamChunkEvent,
  StreamDoneEvent,
  StreamErrorEvent
} from './types'

export interface Unsubscribe {
  (): void
}

export interface RendererApi {
  ball: {
    dragStart: () => void
    dragEnd: () => void
    click: () => void
    contextMenu: () => void
    onStreaming: (cb: (value: boolean) => void) => Unsubscribe
    onAppearance: (cb: () => void) => Unsubscribe
  }
  panel: {
    hide: () => void
    onShow: (cb: () => void) => Unsubscribe
    onCollapseRequest: (cb: () => void) => Unsubscribe
  }
  conv: {
    list: () => Promise<ConversationMeta[]>
    create: (title?: string) => Promise<ConversationMeta>
    get: (id: string) => Promise<Conversation | null>
    rename: (id: string, title: string) => Promise<boolean>
    remove: (id: string) => Promise<boolean>
    search: (query: string) => Promise<ConversationMeta[]>
    exportMd: (id: string) => Promise<{ ok: boolean; path?: string }>
    exportAll: () => Promise<{ ok: boolean; path?: string }>
  }
  chat: {
    send: (payload: ChatSendPayload) => Promise<void>
    stop: (requestId: string) => void
    onChunk: (cb: (e: StreamChunkEvent) => void) => Unsubscribe
    onDone: (cb: (e: StreamDoneEvent) => void) => Unsubscribe
    onError: (cb: (e: StreamErrorEvent) => void) => Unsubscribe
  }
  settings: {
    get: () => Promise<PublicSettings>
    set: (patch: SettingsPatch) => Promise<PublicSettings>
    test: () => Promise<{ ok: boolean; message: string }>
    listModels: () => Promise<{ ok: boolean; models: string[]; message?: string }>
    importOpenCodeKey: () => Promise<{ ok: boolean; message: string }>
    webLogin: () => Promise<boolean>
    webLogout: () => Promise<boolean>
    onTheme: (cb: (dark: boolean) => void) => Unsubscribe
  }
  capture: {
    start: () => void
    submit: (payload: CaptureSubmitPayload) => void
    cancel: () => void
    onInit: (cb: (payload: CaptureInitPayload) => void) => Unsubscribe
  }
  composer: {
    onInsert: (cb: (payload: { text?: string; attachment?: Attachment; mode: 'quote' | 'attach' }) => void) => Unsubscribe
    onToast: (cb: (payload: { type: 'info' | 'warn' | 'error'; message: string }) => void) => Unsubscribe
    onMenu: (cb: (payload: { action: string }) => void) => Unsubscribe
  }
  attach: {
    saveBuffer: (bytes: Uint8Array, mime: string) => Promise<Attachment | null>
  }
  ocr: {
    run: (filePath: string) => Promise<{ ok: boolean; text: string; message?: string }>
  }
  app: {
    openDataDir: () => void
    setAutoLaunch: (enabled: boolean) => Promise<{ ok: boolean; active: boolean; message: string }>
    version: () => Promise<string>
  }
}
