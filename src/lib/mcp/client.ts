import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

/**
 * The MCP endpoint the browser client connects to.
 *
 * Connects straight to the upstream Cangjie docs MCP server. This relies on the
 * server exposing the `mcp-session-id` response header via CORS
 * (`access-control-expose-headers: mcp-session-id`) so the browser can read the
 * session id after `initialize` and echo it on every later request — otherwise
 * the teacher's doc grounding silently breaks. `NEXT_PUBLIC_CANGJIE_MCP_URL`
 * overrides this (e.g. point at a local MCP server during development).
 */
export const MCP_URL = process.env.NEXT_PUBLIC_CANGJIE_MCP_URL ?? 'https://cj-mcp.learningman.top/mcp'

/**
 * Resolve {@link MCP_URL} to an absolute {@link URL}. An absolute URL (the
 * default, or an absolute override) is used as-is; a relative override is
 * resolved against the current origin in the browser. Exported for testing.
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
