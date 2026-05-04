import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

export const MCP_URL = 'https://cj-mcp.learningman.top/mcp'

export interface McpToolDescriptor {
  name: string
  description?: string
  inputSchema: unknown
}

let clientPromise: Promise<Client> | null = null

async function ensureClient(): Promise<Client> {
  if (clientPromise)
    return clientPromise
  clientPromise = (async () => {
    const transport = new StreamableHTTPClientTransport(new URL(MCP_URL))
    const client = new Client({ name: 'playground-cj', version: '0.1.0' })
    await client.connect(transport)
    return client
  })().catch((err) => {
    clientPromise = null
    throw err
  })
  return clientPromise
}

export async function listMcpTools(): Promise<McpToolDescriptor[]> {
  const client = await ensureClient()
  const res = await client.listTools()
  return res.tools.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }))
}

export async function callMcpTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const client = await ensureClient()
  const res = await client.callTool({ name, arguments: args })
  return res
}
