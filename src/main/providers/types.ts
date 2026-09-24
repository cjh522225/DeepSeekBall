import type { ChatMessage, Settings } from '../../shared/types'
import type { OpenAIFunctionTool, ToolCallRequest } from '../mcp/tools'

export interface StreamChunk {
  contentDelta?: string
  reasoningDelta?: string
}

export interface WebStateEvent {
  sessionId: string
  parentMessageId: string | null
}

export interface ProviderTurn {
  toolCalls: ToolCallRequest[]
}

export interface ProviderContext {
  settings: Settings
  apiKey: string
  messages: ChatMessage[]
  apiMessages?: unknown[]
  tools?: OpenAIFunctionTool[]
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
  stream(ctx: ProviderContext): Promise<ProviderTurn>
}

export type ModelInfo = { id: string }
