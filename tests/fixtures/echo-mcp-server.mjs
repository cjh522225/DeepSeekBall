import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const server = new McpServer({ name: 'echo-fixture', version: '1.0.0' })

server.registerTool(
  'get_status',
  {
    description: '只读状态查询工具',
    inputSchema: { city: z.string().optional() }
  },
  async ({ city }) => ({
    content: [{ type: 'text', text: `状态正常${city ? `：${city}` : ''}` }]
  })
)

server.registerTool(
  'create_note',
  {
    description: '写操作示例工具',
    inputSchema: { title: z.string() }
  },
  async ({ title }) => ({
    content: [{ type: 'text', text: `已创建 ${title}` }]
  })
)

await server.connect(new StdioServerTransport())
