import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { McpServerConfig } from '../src/shared/types'

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dsball-mcp-'))

vi.mock('electron', () => ({
  app: { getPath: () => tmpRoot, setPath: () => undefined },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(`enc:${value}`, 'utf8'),
    decryptString: (buffer: Buffer) => buffer.toString('utf8').replace(/^enc:/, '')
  }
}))

let tools: typeof import('../src/main/mcp/tools')
let toolLoop: typeof import('../src/main/mcp/toolLoop')
let managerModule: typeof import('../src/main/mcp/McpManager')

beforeAll(async () => {
  tools = await import('../src/main/mcp/tools')
  toolLoop = await import('../src/main/mcp/toolLoop')
  managerModule = await import('../src/main/mcp/McpManager')
})

function toolCall(id: string, name: string, args = '{"q":"hello"}'): tools.ToolCallRequest {
  return { id, name, argumentsJson: args }
}

type ApiMessage = { role: string; content?: unknown; tool_calls?: unknown; tool_call_id?: string }

function apiMessages(messages: unknown[]): ApiMessage[] {
  return messages as ApiMessage[]
}

describe('openai tools schema', () => {
  it('converts MCP tool info into OpenAI function tools', () => {
    const schema = {
      type: 'object',
      properties: { q: { type: 'string' } },
      required: ['q']
    }
    const result = tools.toOpenAITools([
      {
        exposedName: 'search_docs',
        serverId: 's1',
        serverName: '文档服务',
        tool: { name: 'search_docs', description: '  搜索文档  ', inputSchema: schema }
      }
    ])
    expect(result).toEqual([
      {
        type: 'function',
        function: { name: 'search_docs', description: '搜索文档', parameters: schema }
      }
    ])
  })

  it('falls back to an empty object schema and sanitizes unsafe names', () => {
    const result = tools.toOpenAITools([
      {
        exposedName: 'bad name',
        serverId: 's1',
        serverName: '服务',
        tool: { name: 'bad name', inputSchema: undefined as never }
      }
    ])
    expect(result[0].function.name).toBe('bad_name')
    expect(result[0].function.description).toBeUndefined()
    expect(result[0].function.parameters).toEqual({ type: 'object', properties: {} })
  })

  it('formats MCP results as text for the model', () => {
    expect(
      tools.formatToolResult({ content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] })
    ).toBe('a\nb')
    expect(tools.formatToolResult({ content: [], structuredContent: { x: 1 } })).toBe('{"x":1}')
    expect(tools.formatToolResult({ content: [{ type: 'image', data: 'x', mimeType: 'image/png' }] })).toBe(
      '[图片结果]'
    )
    expect(tools.formatToolResult(null)).toBe('（工具未返回内容）')
  })

  it('parses tool arguments strictly', () => {
    expect(tools.parseToolArguments('')).toEqual({})
    expect(tools.parseToolArguments('{"a":1}')).toEqual({ a: 1 })
    expect(() => tools.parseToolArguments('not-json')).toThrow()
    expect(() => tools.parseToolArguments('[1,2]')).toThrow()
  })
})

describe('write tool detection', () => {
  it('flags create/update/delete and other mutating prefixes', () => {
    const writes = [
      'create_note',
      'UpdateRecord',
      'DELETE_FILE',
      'apply_changes',
      'approve_request',
      'import_data',
      'write_file',
      'post_message',
      'set_config',
      'add_item',
      'remove_item',
      'save_document',
      'clear_cache'
    ]
    for (const name of writes) expect(tools.isWriteTool(name)).toBe(true)
  })

  it('keeps read-only tools out of the confirmation flow', () => {
    const reads = ['get_weather', 'list_docs', 'search', 'read_file', 'query_orders', 'describe_table']
    for (const name of reads) expect(tools.isWriteTool(name)).toBe(false)
  })
})

describe('sse endpoint resolution', () => {
  it('appends the default /sse endpoint when no path is given', () => {
    expect(managerModule.resolveSseUrl('http://localhost:8090')).toBe('http://localhost:8090/sse')
    expect(managerModule.resolveSseUrl('localhost:8090')).toBe('http://localhost:8090/sse')
    expect(managerModule.resolveSseUrl('http://localhost:8090/sse')).toBe('http://localhost:8090/sse')
    expect(managerModule.resolveSseUrl('http://localhost:8090/custom')).toBe(
      'http://localhost:8090/custom'
    )
    expect(() => managerModule.resolveSseUrl('')).toThrow()
  })
})

describe('mcp server config store', () => {
  it('creates, updates, persists and removes servers', async () => {
    const config: McpServerConfig = {
      id: '',
      name: '本地 Agent 服务',
      enabled: true,
      transport: 'sse',
      url: 'http://localhost:8090'
    }
    const created = managerModule.mcpManager.upsertServer(config)
    const server = created.find((item) => item.name === '本地 Agent 服务')
    expect(server).toBeTruthy()
    expect(server?.id).toBeTruthy()

    managerModule.mcpManager.upsertServer({ ...(server as McpServerConfig), name: '改名后的服务' })
    expect(managerModule.mcpManager.listServers().find((item) => item.id === server?.id)?.name).toBe(
      '改名后的服务'
    )

    const raw = JSON.parse(fs.readFileSync(path.join(tmpRoot, 'config.json'), 'utf8')) as {
      mcpServers: McpServerConfig[]
    }
    expect(raw.mcpServers.some((item) => item.id === server?.id && item.name === '改名后的服务')).toBe(
      true
    )

    await managerModule.mcpManager.removeServer(server?.id as string)
    expect(managerModule.mcpManager.listServers().some((item) => item.id === server?.id)).toBe(false)
  })
})

describe('tool call loop', () => {
  it('stops right away when the model returns no tool calls', async () => {
    let turns = 0
    const result = await toolLoop.runToolLoop({
      messages: [],
      tools: [],
      requestTurn: async () => {
        turns += 1
        return { content: '你好', toolCalls: [] }
      }
    })
    expect(turns).toBe(1)
    expect(result.rounds).toBe(1)
    expect(result.content).toBe('你好')
  })

  it('executes tool calls, appends role:tool results and continues streaming', async () => {
    const messages: unknown[] = []
    const executed: string[] = []
    let turns = 0
    const result = await toolLoop.runToolLoop({
      messages,
      tools: [],
      requestTurn: async () => {
        turns += 1
        if (turns === 1) return { content: '', toolCalls: [toolCall('c1', 'search_docs')] }
        return { content: '完成', toolCalls: [] }
      },
      executeTool: async (call) => {
        executed.push(call.name)
        return '工具结果'
      }
    })
    expect(executed).toEqual(['search_docs'])
    expect(turns).toBe(2)
    expect(result.content).toBe('完成')
    const history = apiMessages(messages)
    expect(history[0].role).toBe('assistant')
    expect(history[0].tool_calls).toEqual([
      { id: 'c1', type: 'function', function: { name: 'search_docs', arguments: '{"q":"hello"}' } }
    ])
    expect(history[1]).toEqual({ role: 'tool', tool_call_id: 'c1', content: '工具结果' })
  })

  it('stops at maxRounds instead of looping forever', async () => {
    let turns = 0
    let executed = 0
    let limited: tools.ToolCallRequest[] = []
    const result = await toolLoop.runToolLoop({
      messages: [],
      tools: [],
      requestTurn: async () => {
        turns += 1
        return { content: '', toolCalls: [toolCall(`c${turns}`, 'search_docs')] }
      },
      executeTool: async () => {
        executed += 1
        return 'ok'
      },
      onToolLimit: (pending) => {
        limited = pending
      }
    })
    expect(result.rounds).toBe(tools.MAX_TOOL_ROUNDS)
    expect(turns).toBe(8)
    expect(executed).toBe(8)
    expect(limited.map((call) => call.id)).toEqual(['c8'])
  })

  it('asks for confirmation before write tools and returns the refusal to the model', async () => {
    const messages: unknown[] = []
    const confirmed: string[] = []
    const rejected: string[] = []
    const executed: string[] = []
    let turns = 0
    await toolLoop.runToolLoop({
      messages,
      tools: [],
      requestTurn: async () => {
        turns += 1
        if (turns === 1) {
          return {
            content: '',
            toolCalls: [toolCall('w1', 'create_note'), toolCall('r1', 'read_note')]
          }
        }
        return { content: '好的', toolCalls: [] }
      },
      confirmTool: async (call) => {
        confirmed.push(call.name)
        return false
      },
      executeTool: async (call) => {
        executed.push(call.name)
        return '内容'
      },
      onToolRejected: (call) => {
        rejected.push(call.id)
      }
    })
    expect(confirmed).toEqual(['create_note'])
    expect(executed).toEqual(['read_note'])
    expect(rejected).toEqual(['w1'])
    const toolResults = apiMessages(messages).filter((message) => message.role === 'tool')
    expect(toolResults).toHaveLength(2)
    expect(toolResults[0].content).toBe(toolLoop.REJECTED_TOOL_RESULT)
    expect(toolResults[1].content).toBe('内容')
  })

  it('turns tool failures into tool results instead of crashing the conversation', async () => {
    const messages: unknown[] = []
    const failures: string[] = []
    let turns = 0
    await toolLoop.runToolLoop({
      messages,
      tools: [],
      requestTurn: async () => {
        turns += 1
        if (turns === 1) return { content: '', toolCalls: [toolCall('e1', 'get_data')] }
        return { content: '已降级回答', toolCalls: [] }
      },
      executeTool: async () => {
        throw new Error('boom')
      },
      onToolResult: (call, _result, failed) => {
        if (failed) failures.push(call.id)
      }
    })
    expect(turns).toBe(2)
    const toolResult = apiMessages(messages).find((message) => message.role === 'tool')
    expect(String(toolResult?.content)).toContain('工具执行失败：boom')
    expect(failures).toEqual(['e1'])
  })

  it('aborts the loop when the signal is cancelled', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      toolLoop.runToolLoop({
        messages: [],
        tools: [],
        signal: controller.signal,
        requestTurn: async () => ({ content: '', toolCalls: [] })
      })
    ).rejects.toThrow('已停止')
  })
})

describe('stdio end to end', () => {
  it('connects to a real stdio MCP server, lists tools and calls one', async () => {
    const fixture = fileURLToPath(new URL('./fixtures/echo-mcp-server.mjs', import.meta.url))
    const id = 'stdio-fixture'
    managerModule.mcpManager.upsertServer({
      id,
      name: 'echo-fixture',
      enabled: true,
      transport: 'stdio',
      command: process.execPath,
      args: [fixture]
    })

    const status = await managerModule.mcpManager.connect(id)
    expect(status.state).toBe('connected')
    expect(status.tools.map((tool) => tool.name).sort()).toEqual(['create_note', 'get_status'])

    const call = await managerModule.mcpManager.callTool({
      name: 'get_status',
      arguments: '{"city":"北京"}'
    })
    expect(call.ok).toBe(true)
    expect(call.text).toContain('状态正常：北京')

    await managerModule.mcpManager.removeServer(id)
    expect(managerModule.mcpManager.listServers().some((server) => server.id === id)).toBe(false)
  }, 30_000)
})
