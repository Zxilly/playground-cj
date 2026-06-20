import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

/**
 * The MCP endpoint the browser client connects to.
 *
 * Defaults to the same-origin proxy (`/api/cangjie-mcp`) rather than the upstream
 * directly: the upstream does not expose the `mcp-session-id` response header via
 * CORS, so a direct browser connection cannot maintain a session and the
 * teacher's doc grounding silently breaks (see the proxy route for the full
 * write-up). `NEXT_PUBLIC_CANGJIE_MCP_URL` still overrides this with an absolute
 * URL for deployments whose MCP server sets the right CORS headers.
 */
export const MCP_URL = process.env.NEXT_PUBLIC_CANGJIE_MCP_URL ?? '/api/cangjie-mcp'

/**
 * Resolve {@link MCP_URL} to an absolute {@link URL}. A relative default
 * (`/api/cangjie-mcp`) is resolved against the current origin in the browser;
 * an absolute override is used as-is. Exported for testing.
 */
export function resolveMcpUrl(base: string | undefined = typeof window === 'undefined' ? undefined : window.location.origin): URL {
  return new URL(MCP_URL, base)
}

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
    const transport = new StreamableHTTPClientTransport(resolveMcpUrl())
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

export async function callMcpTool(
  name: string,
  args: Record<string, unknown>,
  abortSignal?: AbortSignal,
): Promise<unknown> {
  const client = await ensureClient()
  const res = await client.callTool(
    { name, arguments: args },
    undefined,
    abortSignal ? { signal: abortSignal } : undefined,
  )
  return res
}
