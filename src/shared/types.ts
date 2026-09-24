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
  toolCalls?: ToolCallRecord[]
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

export type McpTransportKind = 'sse' | 'stdio'

export interface McpServerConfig {
  id: string
  name: string
  enabled: boolean
  transport: McpTransportKind
  url?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
}

export interface McpToolInfo {
  name: string
  description?: string
  inputSchema: Record<string, unknown>
}

export type McpConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface McpServerStatus {
  id: string
  state: McpConnectionState
  error?: string
  tools: McpToolInfo[]
  updatedAt: number
}

export type ToolCallStatus = 'running' | 'awaiting' | 'success' | 'error' | 'rejected'

export interface ToolCallRecord {
  id: string
  name: string
  serverId: string
  serverName: string
  args: string
  status: ToolCallStatus
  result?: string
  error?: string
  createdAt: number
}

export interface ToolCallEvent {
  requestId: string
  conversationId: string
  toolCall: ToolCallRecord
}

export interface ToolConfirmRequestEvent {
  requestId: string
  conversationId: string
  toolCall: ToolCallRecord
}

export interface ToolConfirmResponsePayload {
  requestId: string
  toolCallId: string
  approved: boolean
}

export interface McpCallToolPayload {
  serverId?: string
  name: string
  arguments: string
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
  mcpServers: McpServerConfig[]
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
