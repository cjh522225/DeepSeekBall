import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { Implementation } from '@modelcontextprotocol/sdk/types.js'
import { randomUUID } from 'node:crypto'
import { loadSettings, saveSettings } from '../config'
import type {
  McpCallToolPayload,
  McpServerConfig,
  McpServerStatus,
  McpToolInfo
} from '../../shared/types'
import {
  formatToolResult,
  parseToolArguments,
  sanitizeToolName,
  type McpToolBinding
} from './tools'

export const MCP_CLIENT_INFO: Implementation = { name: 'deepseek-ball', version: '0.1.0' }

const DEFAULT_SSE_PATH = '/sse'
const CONNECT_TIMEOUT_MS = 15_000

export function resolveSseUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) throw new Error('请填写 SSE 服务地址')
  const url = new URL(/^[a-z]+:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`)
  if (!url.pathname || url.pathname === '/') url.pathname = DEFAULT_SSE_PATH
  return url.toString()
}

function disconnectedStatus(id: string): McpServerStatus {
  return { id, state: 'disconnected', tools: [], updatedAt: Date.now() }
}

interface ClientEntry {
  config: McpServerConfig
  client: Client
  transport: Transport
  status: McpServerStatus
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    )
  })
}

class McpManager {
  private entries = new Map<string, ClientEntry>()
  private statusListeners = new Set<(status: McpServerStatus) => void>()
  private toolListeners = new Set<(serverId: string, tools: McpToolInfo[]) => void>()
  private bindings = new Map<string, McpToolBinding>()

  listServers(): McpServerConfig[] {
    return [...(loadSettings().mcpServers ?? [])]
  }

  upsertServer(config: McpServerConfig): McpServerConfig[] {
    const servers = this.listServers()
    const index = servers.findIndex((s) => s.id === config.id)
    const normalized: McpServerConfig = { ...config, id: config.id || randomUUID() }
    if (index >= 0) servers[index] = { ...servers[index], ...normalized }
    else servers.push(normalized)
    saveSettings({ mcpServers: servers })
    return this.listServers()
  }

  async removeServer(id: string): Promise<McpServerConfig[]> {
    await this.disconnect(id)
    const servers = this.listServers().filter((s) => s.id !== id)
    saveSettings({ mcpServers: servers })
    return this.listServers()
  }

  listStatuses(): McpServerStatus[] {
    return this.listServers().map((config) => this.statusOf(config.id))
  }

  statusOf(id: string): McpServerStatus {
    return this.entries.get(id)?.status ?? disconnectedStatus(id)
  }

  listTools(serverId?: string): McpToolInfo[] {
    if (serverId) return this.statusOf(serverId).tools
    return [...this.bindings.values()].map((binding) => binding.tool)
  }

  toolBindings(): McpToolBinding[] {
    return [...this.bindings.values()]
  }

  connectedServers(): McpServerConfig[] {
    return this.listServers().filter((config) => this.statusOf(config.id).state === 'connected')
  }

  onStatus(cb: (status: McpServerStatus) => void): () => void {
    this.statusListeners.add(cb)
    return () => this.statusListeners.delete(cb)
  }

  onTools(cb: (serverId: string, tools: McpToolInfo[]) => void): () => void {
    this.toolListeners.add(cb)
    return () => this.toolListeners.delete(cb)
  }

  private emit(status: McpServerStatus): void {
    for (const listener of this.statusListeners) listener(status)
  }

  private setStatus(id: string, state: McpServerStatus['state'], error?: string, tools?: McpToolInfo[]): McpServerStatus {
    const previous = this.statusOf(id)
    const status: McpServerStatus = {
      id,
      state,
      error,
      tools: tools ?? (state === 'connected' ? previous.tools : []),
      updatedAt: Date.now()
    }
    const entry = this.entries.get(id)
    if (entry) entry.status = status
    this.emit(status)
    return status
  }

  private rebuildBindings(): void {
    const used = new Set<string>()
    const next = new Map<string, McpToolBinding>()
    for (const config of this.connectedServers()) {
      const tools = this.statusOf(config.id).tools
      for (const tool of tools) {
        const base = sanitizeToolName(tool.name)
        let exposedName = base
        let suffix = 1
        while (used.has(exposedName)) {
          suffix += 1
          exposedName = sanitizeToolName(`${base}_${suffix}`)
        }
        used.add(exposedName)
        next.set(exposedName, {
          exposedName,
          serverId: config.id,
          serverName: config.name,
          tool
        })
      }
    }
    this.bindings = next
  }

  private publishTools(serverId: string, tools: McpToolInfo[]): void {
    this.rebuildBindings()
    for (const listener of this.toolListeners) listener(serverId, tools)
  }

  private createTransport(config: McpServerConfig): Transport {
    if (config.transport === 'stdio') {
      if (!config.command?.trim()) throw new Error('stdio 传输需要填写可执行命令')
      return new StdioClientTransport({
        command: config.command.trim(),
        args: config.args?.filter((arg) => arg.length > 0),
        env: config.env && Object.keys(config.env).length > 0 ? config.env : undefined,
        stderr: 'ignore'
      })
    }
    if (!config.url?.trim()) throw new Error('SSE 传输需要填写服务地址')
    return new SSEClientTransport(new URL(resolveSseUrl(config.url)))
  }

  private async fetchTools(client: Client): Promise<McpToolInfo[]> {
    const result = await client.listTools()
    return result.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: (tool.inputSchema ?? {}) as Record<string, unknown>
    }))
  }

  private async disposeEntry(id: string): Promise<void> {
    const entry = this.entries.get(id)
    if (!entry) return
    this.entries.delete(id)
    entry.client.onclose = undefined
    entry.client.onerror = undefined
    try {
      await entry.client.close()
    } catch {
      try {
        await entry.transport.close()
      } catch {
        void 0
      }
    }
  }

  async connect(id: string): Promise<McpServerStatus> {
    const config = this.listServers().find((s) => s.id === id)
    if (!config) return this.setStatus(id, 'error', '未找到该 MCP 服务器配置')
    await this.disposeEntry(id)
    this.setStatus(id, 'connecting')
    try {
      const client = new Client(MCP_CLIENT_INFO)
      const transport = this.createTransport(config)
      await withTimeout(client.connect(transport), CONNECT_TIMEOUT_MS, '连接超时')
      this.entries.set(id, { config, client, transport, status: disconnectedStatus(id) })
      client.onclose = () => {
        if (!this.entries.has(id)) return
        void this.disposeEntry(id).then(() => {
          this.setStatus(id, 'disconnected')
          this.publishTools(id, [])
        })
      }
      client.onerror = (error) => {
        this.setStatus(id, 'error', error.message)
      }
      const tools = await this.fetchTools(client)
      const status = this.setStatus(id, 'connected', undefined, tools)
      this.publishTools(id, tools)
      return status
    } catch (error) {
      await this.disposeEntry(id)
      const message = error instanceof Error ? error.message : String(error)
      return this.setStatus(id, 'error', message)
    }
  }

  async disconnect(id: string): Promise<McpServerStatus> {
    const existed = this.entries.has(id)
    await this.disposeEntry(id)
    if (existed) this.publishTools(id, [])
    return this.setStatus(id, 'disconnected')
  }

  async disconnectAll(): Promise<void> {
    for (const id of [...this.entries.keys()]) await this.disposeEntry(id)
    this.bindings.clear()
  }

  async refresh(): Promise<McpServerStatus[]> {
    const servers = this.listServers().filter((config) => config.enabled)
    for (const config of this.listServers()) {
      if (!config.enabled) await this.disconnect(config.id)
    }
    for (const config of servers) await this.connect(config.id)
    return this.listStatuses()
  }

  async testConnection(
    config: McpServerConfig
  ): Promise<{ ok: boolean; message: string; tools: McpToolInfo[] }> {
    const label = config.name?.trim() || 'MCP 服务器'
    try {
      const client = new Client(MCP_CLIENT_INFO)
      const transport = this.createTransport(config)
      await withTimeout(client.connect(transport), CONNECT_TIMEOUT_MS, '连接超时')
      const tools = await this.fetchTools(client)
      await client.close().catch(() => undefined)
      return { ok: true, message: `${label} 连接成功，可用工具 ${tools.length} 个`, tools }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { ok: false, message: `${label} 连接失败：${message}`, tools: [] }
    }
  }

  async callTool(payload: McpCallToolPayload): Promise<{ ok: boolean; text: string }> {
    const binding = this.bindings.get(payload.name)
    const serverId = payload.serverId ?? binding?.serverId
    const entry = serverId ? this.entries.get(serverId) : undefined
    if (!entry || entry.status.state !== 'connected') {
      return { ok: false, text: `MCP 服务器未连接，无法调用工具 ${payload.name}` }
    }
    const toolName = payload.serverId ? payload.name : binding?.tool.name ?? payload.name
    try {
      const args = parseToolArguments(payload.arguments)
      const result = await entry.client.callTool({ name: toolName, arguments: args })
      const record = result as { isError?: boolean }
      return { ok: !record.isError, text: formatToolResult(result) }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { ok: false, text: `工具执行失败：${message}` }
    }
  }
}

export const mcpManager = new McpManager()
