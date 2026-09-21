export type Role = 'system' | 'user' | 'assistant'

export type MessageStatus = 'pending' | 'streaming' | 'done' | 'error' | 'aborted'

export interface Attachment {
  id: string
  type: 'image'
  filePath: string
  width?: number
  height?: number
  ocrText?: string
}

export interface ChatMessage {
  id: string
  role: Role
  content: string
  reasoning?: string
  status: MessageStatus
  error?: string
  attachments?: Attachment[]
  createdAt: number
  model?: string
}

export interface ConversationMeta {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
  webSessionId?: string
  webParentMessageId?: string | null
}

export interface Conversation extends ConversationMeta {
  messages: ChatMessage[]
}

export type ProviderKind = 'official' | 'custom' | 'web'

export interface HotkeySettings {
  togglePanel: string
  screenshot: string
  clipboard: string
}

export interface Settings {
  provider: ProviderKind
  baseUrl: string
  model: string
  temperature: number
  systemPrompt: string
  maxContextMessages: number
  imageHandling: 'ocr' | 'vision'
  theme: 'system' | 'light' | 'dark'
  showReasoning: boolean
  ballSize: number
  ballOpacity: number
  ballSide: 'left' | 'right'
  ballY: number
  hideOnFullscreen: boolean
  hotkeys: HotkeySettings
  autoLaunch: boolean
}

export interface PublicSettings extends Settings {
  apiKeySet: boolean
  webLoggedIn: boolean
  autoLaunchActive: boolean
  autoLaunchSupported: boolean
  version: string
  failedHotkeys: string[]
}

export interface ChatSendPayload {
  conversationId: string
  text: string
  attachments?: Attachment[]
  requestId: string
  regenerate?: boolean
}

export interface StreamChunkEvent {
  requestId: string
  conversationId: string
  contentDelta?: string
  reasoningDelta?: string
}

export interface StreamDoneEvent {
  requestId: string
  conversationId: string
  message: ChatMessage
  title?: string
  webSessionId?: string
  webParentMessageId?: string | null
}

export interface StreamErrorEvent {
  requestId: string
  conversationId: string
  error: string
}

export interface CaptureInitPayload {
  dataUrl: string
  scaleFactor: number
  bounds: { x: number; y: number; width: number; height: number }
  displayId: number
}

export interface CaptureSubmitPayload {
  pngBase64: string
  width: number
  height: number
}

export interface ComposerInsertEvent {
  text?: string
  attachment?: Attachment
  mode: 'quote' | 'attach'
}

export interface SettingsPatch extends Partial<Settings> {
  apiKey?: string
}
