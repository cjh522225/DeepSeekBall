import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dsball-mcp-live-'))
const LIVE = process.env.MCP_LIVE === '1'
const liveDescribe = LIVE ? describe : describe.skip

vi.mock('electron', () => ({
  app: { getPath: () => tmpRoot, setPath: () => undefined },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(`enc:${value}`, 'utf8'),
    decryptString: (buffer: Buffer) => buffer.toString('utf8').replace(/^enc:/, '')
  }
}))

let managerModule: typeof import('../src/main/mcp/McpManager')

beforeAll(async () => {
  managerModule = await import('../src/main/mcp/McpManager')
})

liveDescribe('live mcp server', () => {
  it('connects to localhost:8090 and lists tools', async () => {
    const servers = managerModule.mcpManager.upsertServer({
      id: '',
      name: 'agent-service (live)',
      enabled: true,
      transport: 'sse',
      url: 'http://localhost:8090'
    })
    const server = servers.find((s) => s.name === 'agent-service (live)')
    expect(server).toBeTruthy()
    const status = await managerModule.mcpManager.connect(server?.id as string)
    console.log('STATUS:', JSON.stringify({ state: status.state, error: status.error }))
    console.log('TOOLS:', JSON.stringify(status.tools.map((t) => t.name)))
    console.log('TOOL-COUNT:', status.tools.length)
    expect(status.state).toBe('connected')

    const readTool = status.tools.find(
      (t) =>
        !/^(create|update|delete|apply|approve|import|write|post|set|add|remove|save|clear)/i.test(
          t.name
        )
    )
    if (readTool) {
      console.log('READ-TOOL:', readTool.name, JSON.stringify(readTool.inputSchema).slice(0, 400))
    }
    const target = readTool ?? status.tools[0]
    if (!target) {
      console.log('NO-TOOLS: 服务端未暴露任何工具，跳过 callTool 验证')
      await managerModule.mcpManager.disconnectAll()
      return
    }
    const raw = await managerModule.mcpManager.callTool({ name: target.name, arguments: '{}' })
    console.log('CALL-TOOL:', target.name)
    console.log('CALL-RESULT-OK:', raw.ok)
    console.log('CALL-RESULT:', raw.text.slice(0, 600))
    await managerModule.mcpManager.disconnectAll()
  }, 60_000)
})
