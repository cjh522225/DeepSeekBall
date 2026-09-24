import type { McpToolInfo } from '../../shared/types'

export const MAX_TOOL_ROUNDS = 8

export const WRITE_TOOL_PATTERN =
  /^(create|update|delete|apply|approve|import|write|post|set|add|remove|save|clear)/i

const TOOL_NAME_LIMIT = 64
const DEFAULT_SCHEMA: Record<string, unknown> = { type: 'object', properties: {} }

export interface OpenAIFunctionTool {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters: Record<string, unknown>
  }
}

export interface ToolCallRequest {
  id: string
  name: string
  argumentsJson: string
}

export interface McpToolBinding {
  exposedName: string
  serverId: string
  serverName: string
  tool: McpToolInfo
}

export function isWriteTool(name: string): boolean {
  return WRITE_TOOL_PATTERN.test(name.trim())
}

export function sanitizeToolName(name: string): string {
  const cleaned = name.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, TOOL_NAME_LIMIT)
  return cleaned.length > 0 ? cleaned : 'tool'
}

function normalizeSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return { ...DEFAULT_SCHEMA }
  const record = schema as Record<string, unknown>
  if (record.type !== 'object') return { ...DEFAULT_SCHEMA, ...record, type: 'object' }
  return { ...record, properties: record.properties ?? {} }
}

export function toOpenAITools(bindings: McpToolBinding[]): OpenAIFunctionTool[] {
  return bindings.map((binding) => {
    const description = binding.tool.description?.trim()
    return {
      type: 'function' as const,
      function: {
        name: sanitizeToolName(binding.exposedName),
        ...(description ? { description } : {}),
        parameters: normalizeSchema(binding.tool.inputSchema)
      }
    }
  })
}

export function formatToolResult(result: unknown): string {
  if (result === null || result === undefined) return '（工具未返回内容）'
  if (typeof result !== 'object') return String(result)
  const record = result as {
    content?: unknown
    structuredContent?: unknown
    isError?: boolean
  }
  const parts: string[] = []
  if (Array.isArray(record.content)) {
    for (const item of record.content) {
      if (!item || typeof item !== 'object') continue
      const block = item as { type?: unknown; text?: unknown; uri?: unknown; mimeType?: unknown }
      if (block.type === 'text' && typeof block.text === 'string') parts.push(block.text)
      else if (block.type === 'image') parts.push('[图片结果]')
      else if (block.type === 'audio') parts.push('[音频结果]')
      else if (block.type === 'resource') parts.push(`[资源 ${String(block.uri ?? '')}]`)
      else if (block.type === 'resource_link') parts.push(`[资源链接 ${String(block.uri ?? '')}]`)
    }
  }
  if (parts.length === 0 && record.structuredContent !== undefined) {
    parts.push(JSON.stringify(record.structuredContent))
  }
  if (parts.length === 0) {
    try {
      parts.push(JSON.stringify(result))
    } catch {
      parts.push(String(result))
    }
  }
  const text = parts.join('\n').trim()
  return text.length > 0 ? text : '（工具返回空内容）'
}

export function parseToolArguments(argumentsJson: string): Record<string, unknown> {
  const trimmed = argumentsJson.trim()
  if (!trimmed) return {}
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('参数必须是 JSON 对象')
    }
    return parsed as Record<string, unknown>
  } catch (error) {
    throw new Error(`工具参数不是合法 JSON：${error instanceof Error ? error.message : String(error)}`)
  }
}

export function summarizeToolArguments(argumentsJson: string, limit = 120): string {
  const trimmed = argumentsJson.trim()
  if (!trimmed) return '（无参数）'
  return trimmed.length > limit ? `${trimmed.slice(0, limit)}…` : trimmed
}
