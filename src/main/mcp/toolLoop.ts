import { isWriteTool, MAX_TOOL_ROUNDS, type OpenAIFunctionTool, type ToolCallRequest } from './tools'

export const REJECTED_TOOL_RESULT = '用户拒绝执行该工具调用'

export interface ToolTurn {
  content: string
  toolCalls: ToolCallRequest[]
}

export interface ToolLoopHooks {
  requestTurn: (messages: unknown[], tools: OpenAIFunctionTool[]) => Promise<ToolTurn>
  executeTool: (call: ToolCallRequest) => Promise<string>
  confirmTool: (call: ToolCallRequest) => Promise<boolean>
  onToolCall: (call: ToolCallRequest) => void
  onToolResult: (call: ToolCallRequest, result: string, failed: boolean) => void
  onToolRejected: (call: ToolCallRequest) => void
  onToolLimit: (pending: ToolCallRequest[]) => void
}

export interface ToolLoopOptions {
  messages: unknown[]
  tools: OpenAIFunctionTool[]
  signal?: AbortSignal
  maxRounds?: number
  requestTurn: ToolLoopHooks['requestTurn']
  executeTool?: ToolLoopHooks['executeTool']
  confirmTool?: ToolLoopHooks['confirmTool']
  onToolCall?: ToolLoopHooks['onToolCall']
  onToolResult?: ToolLoopHooks['onToolResult']
  onToolRejected?: ToolLoopHooks['onToolRejected']
  onToolLimit?: ToolLoopHooks['onToolLimit']
}

export interface ToolLoopResult {
  content: string
  rounds: number
}

function assistantToolCallMessage(turn: ToolTurn): Record<string, unknown> {
  return {
    role: 'assistant',
    content: turn.content || null,
    tool_calls: turn.toolCalls.map((call) => ({
      id: call.id,
      type: 'function',
      function: { name: call.name, arguments: call.argumentsJson }
    }))
  }
}

function toolResultMessage(call: ToolCallRequest, content: string): Record<string, unknown> {
  return { role: 'tool', tool_call_id: call.id, content }
}

function aborted(signal?: AbortSignal): boolean {
  return Boolean(signal?.aborted)
}

export async function runToolLoop(options: ToolLoopOptions): Promise<ToolLoopResult> {
  const maxRounds = Math.max(1, options.maxRounds ?? MAX_TOOL_ROUNDS)
  const { messages, tools } = options
  const collected: string[] = []
  let rounds = 0
  let pending: ToolCallRequest[] = []

  while (true) {
    if (aborted(options.signal)) throw new Error('已停止')
    if (rounds >= maxRounds) {
      options.onToolLimit?.(pending)
      break
    }
    const turn = await options.requestTurn(messages, tools)
    rounds += 1
    if (turn.content) collected.push(turn.content)
    if (turn.toolCalls.length === 0) break

    pending = turn.toolCalls
    messages.push(assistantToolCallMessage(turn))
    for (const call of pending) {
      if (aborted(options.signal)) throw new Error('已停止')
      options.onToolCall?.(call)
      if (isWriteTool(call.name)) {
        const approved = await options.confirmTool?.(call)
        if (!approved) {
          messages.push(toolResultMessage(call, REJECTED_TOOL_RESULT))
          options.onToolRejected?.(call)
          continue
        }
      }
      let resultText: string
      let failed = false
      try {
        resultText = (await options.executeTool?.(call)) ?? ''
      } catch (error) {
        failed = true
        resultText = `工具执行失败：${error instanceof Error ? error.message : String(error)}`
      }
      messages.push(toolResultMessage(call, resultText))
      options.onToolResult?.(call, resultText, failed)
    }
  }

  return { content: collected.join(''), rounds }
}
