import type { ChatMessage, Settings } from '../../shared/types'

export interface StreamChunk {
  contentDelta?: string
  reasoningDelta?: string
}

export interface WebStateEvent {
  sessionId: string
  parentMessageId: string | null
}

export interface ProviderContext {
  settings: Settings
  apiKey: string
  messages: ChatMessage[]
  signal: AbortSignal
  sessionId?: string
  onChunk: (chunk: StreamChunk) => void
  onWebState?: (state: WebStateEvent) => void
  web?: {
    sessionId?: string
    parentMessageId?: string | null
  }
}

export interface ChatProvider {
  stream(ctx: ProviderContext): Promise<void>
}

export type ModelInfo = { id: string }
