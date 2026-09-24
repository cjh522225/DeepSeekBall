import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import OpenAI from 'openai'
import type { ChatMessage, Settings } from '../../shared/types'
import type { ChatProvider, ProviderContext, ProviderTurn } from './types'
import type { ToolCallRequest } from '../mcp/tools'

export const OPENCODE_CLIENT = 'deepseek-ball/0.1.0'

export function isOpenCodeGo(settings: Settings): boolean {
  return /opencode\.ai/i.test(settings.baseUrl)
}

export function buildRequestHeaders(
  settings: Settings,
  sessionId?: string
): Record<string, string> {
  if (!isOpenCodeGo(settings)) return {}
  return {
    'x-opencode-client': OPENCODE_CLIENT,
    'x-opencode-session': sessionId?.trim() || randomUUID(),
    'x-opencode-request': randomUUID()
  }
}

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif'
}

type ApiContent = string | Array<Record<string, unknown>>

function toApiContent(message: ChatMessage, vision: boolean): ApiContent {
  if (message.role !== 'user' || !vision || !message.attachments?.length) return message.content
  const parts: Array<Record<string, unknown>> = []
  for (const attachment of message.attachments) {
    try {
      const data = fs.readFileSync(attachment.filePath).toString('base64')
      const mime = MIME_BY_EXT[path.extname(attachment.filePath).toLowerCase()] ?? 'image/png'
      parts.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${data}` } })
    } catch {
      void 0
    }
  }
  parts.push({ type: 'text', text: message.content })
  return parts
}

export function buildApiMessages(settings: Settings, messages: ChatMessage[]): unknown[] {
  const usable = messages.filter(
    (m) =>
      m.role !== 'system' &&
      m.status !== 'error' &&
      (m.content.trim().length > 0 || (m.attachments?.length ?? 0) > 0)
  )
  const context = usable.slice(-Math.max(1, settings.maxContextMessages))
  const result: Array<Record<string, unknown>> = []
  const modeText =
    settings.agentMode === 'plan'
      ? '当前处于 Plan（计划）模式：你可以读取文件、检索内容与查询数据，但禁止修改文件、执行命令或调用任何写操作。请先给出实施计划（目标、步骤、涉及文件、风险点），并提示用户切换到 Build 模式后再执行。'
      : '当前处于 Build（构建）模式：你可以读写文件、执行命令与调用工具；破坏性操作会请求用户确认。'
  const systemText = [settings.systemPrompt.trim(), modeText].filter((part) => part.length > 0).join('\n\n')
  result.push({ role: 'system', content: systemText })
  for (const message of context) {
    result.push({
      role: message.role,
      content: toApiContent(message, settings.imageHandling === 'vision')
    })
  }
  return result
}

function createClient(settings: Settings, apiKey: string, timeout: number): OpenAI {
  if (!apiKey.trim()) throw new Error('未配置 API Key，请在设置中填写')
  return new OpenAI({
    apiKey: apiKey.trim(),
    baseURL: settings.baseUrl.trim().replace(/\/+$/, ''),
    timeout,
    maxRetries: 1
  })
}

export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  const cause = (error as { cause?: unknown }).cause
  const causeText =
    cause instanceof Error
      ? cause.message
      : cause && typeof cause === 'object'
        ? JSON.stringify(cause).slice(0, 200)
        : ''
  return causeText ? `${error.message}（${causeText}）` : error.message
}

export const openAICompatibleProvider: ChatProvider = {
  async stream(ctx: ProviderContext): Promise<ProviderTurn> {
    const client = createClient(ctx.settings, ctx.apiKey, 180_000)
    const drafts = new Map<number, ToolCallDraft>()
    try {
      const stream = await client.chat.completions.create(
        {
          model: ctx.settings.model,
          messages: (ctx.apiMessages ?? buildApiMessages(ctx.settings, ctx.messages)) as never,
          temperature: ctx.settings.temperature,
          stream: true,
          tools: ctx.tools?.length ? (ctx.tools as never) : undefined
        },
        {
          signal: ctx.signal,
          headers: buildRequestHeaders(ctx.settings, ctx.sessionId)
        }
      )
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta as
          | { content?: string; reasoning_content?: string; tool_calls?: ToolCallDelta[] }
          | undefined
        if (!delta) continue
        if (delta.reasoning_content) ctx.onChunk({ reasoningDelta: delta.reasoning_content })
        if (delta.content) ctx.onChunk({ contentDelta: delta.content })
        if (delta.tool_calls?.length) accumulateToolCalls(drafts, delta.tool_calls)
      }
    } catch (error) {
      if (ctx.signal.aborted) throw error
      throw new Error(describeError(error))
    }
    return { toolCalls: toToolCallRequests(drafts) }
  }
}

interface ToolCallDraft {
  id: string
  name: string
  arguments: string
}

interface ToolCallDelta {
  index?: number
  id?: string
  function?: { name?: string; arguments?: string }
}

function accumulateToolCalls(drafts: Map<number, ToolCallDraft>, deltas: ToolCallDelta[]): void {
  for (const delta of deltas) {
    const index = delta.index ?? 0
    const draft = drafts.get(index) ?? { id: '', name: '', arguments: '' }
    if (delta.id) draft.id = delta.id
    if (delta.function?.name) draft.name = delta.function.name
    if (delta.function?.arguments) draft.arguments += delta.function.arguments
    drafts.set(index, draft)
  }
}

function toToolCallRequests(drafts: Map<number, ToolCallDraft>): ToolCallRequest[] {
  return [...drafts.entries()]
    .sort(([a], [b]) => a - b)
    .filter(([, draft]) => draft.name.length > 0)
    .map(([, draft]) => ({
      id: draft.id || randomUUID(),
      name: draft.name,
      argumentsJson: draft.arguments
    }))
}

export async function testConnection(
  settings: Settings,
  apiKey: string
): Promise<{ ok: boolean; message: string }> {
  try {
    const client = createClient(settings, apiKey, 20_000)
    const models = await client.models.list()
    const count = models.data?.length ?? 0
    return { ok: true, message: `连接成功，可用模型 ${count} 个` }
  } catch (error) {
    return { ok: false, message: describeError(error) }
  }
}

export async function listModels(
  settings: Settings,
  apiKey: string
): Promise<{ ok: boolean; models: string[]; message?: string }> {
  try {
    const client = createClient(settings, apiKey, 20_000)
    const models = await client.models.list()
    return { ok: true, models: (models.data ?? []).map((m) => m.id) }
  } catch (error) {
    return { ok: false, models: [], message: describeError(error) }
  }
}
