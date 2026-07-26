import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { awaitWithSignal } from '@/lib/ai/abortable-operation'

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

const MCP_CONNECT_TIMEOUT_MS = 10_000

interface McpClientOwner {
  result: Promise<Client>
}

let clientOwner: McpClientOwner | null = null

function connectionAbortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('MCP connection timed out', 'TimeoutError')
}

function createClientOwner(): McpClientOwner {
  const transport = new StreamableHTTPClientTransport(resolveMcpUrl())
  const client = new Client({ name: 'playground-cj', version: '0.1.0' })
  const connectionSignal = AbortSignal.timeout(MCP_CONNECT_TIMEOUT_MS)
  let closePromise: Promise<void> | null = null
  const close = () => {
    closePromise ??= Promise.resolve().then(() => client.close())
    return closePromise
  }
  let rawConnect: Promise<void>
  try {
    rawConnect = Promise.resolve(client.connect(transport, {
      signal: connectionSignal,
      timeout: MCP_CONNECT_TIMEOUT_MS,
    }))
  }
  catch (error) {
    rawConnect = Promise.reject(error)
  }

  let resolveResult!: (client: Client) => void
  let rejectResult!: (error: unknown) => void
  const result = new Promise<Client>((resolve, reject) => {
    resolveResult = resolve
    rejectResult = reject
  })
  const owner: McpClientOwner = { result }
  let resultSettled = false
  let cleanupStarted = false
  let fail!: (error: unknown) => void
  const handleConnectionAbort = () => {
    fail(connectionAbortReason(connectionSignal))
  }
  const removeDeadlineListener = () => {
    connectionSignal.removeEventListener('abort', handleConnectionAbort)
  }
  fail = (error: unknown) => {
    if (!resultSettled) {
      resultSettled = true
      rejectResult(error)
    }
    if (cleanupStarted)
      return
    cleanupStarted = true
    const closing = close()
    void Promise.allSettled([rawConnect, closing]).then(() => {
      removeDeadlineListener()
      if (clientOwner === owner)
        clientOwner = null
    })
  }
  connectionSignal.addEventListener('abort', handleConnectionAbort, { once: true })
  if (connectionSignal.aborted)
    handleConnectionAbort()

  void rawConnect.then(
    () => {
      if (connectionSignal.aborted) {
        fail(connectionAbortReason(connectionSignal))
        return
      }
      resultSettled = true
      removeDeadlineListener()
      resolveResult(client)
    },
    error => fail(error),
  )
  return owner
}

async function ensureClient(signal?: AbortSignal): Promise<Client> {
  signal?.throwIfAborted()
  clientOwner ??= createClientOwner()
  return awaitWithSignal(clientOwner.result, signal)
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
  const client = await ensureClient(abortSignal)
  const res = await awaitWithSignal(
    client.callTool(
      { name, arguments: args },
      undefined,
      abortSignal ? { signal: abortSignal } : undefined,
    ),
    abortSignal,
  )
  return res
}
