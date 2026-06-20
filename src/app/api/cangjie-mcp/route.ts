/**
 * Same-origin reverse proxy for the Cangjie documentation MCP server.
 *
 * Why this exists: the browser teacher agent grounds every Cangjie fact through
 * the `cangjie_search_docs` MCP tool (see `src/lib/teach/knowledge/cangjie-mcp-source.ts`).
 * The MCP Streamable-HTTP protocol carries the session in a `mcp-session-id`
 * response header that the client must read after `initialize` and echo on
 * every later request. The upstream sends `access-control-allow-origin: *` but
 * does NOT send `access-control-expose-headers: mcp-session-id`, so a
 * cross-origin browser request can never read that header — the session id stays
 * undefined, the follow-up `tools/call` is rejected, and the teacher silently
 * loses its grounding (and starts inventing wrong syntax).
 *
 * Routing the MCP traffic through this same-origin endpoint removes CORS from the
 * picture entirely: the proxy runs server-side (no CORS), reads `mcp-session-id`
 * off the upstream response, and hands it back on a same-origin response where
 * the browser can read every header.
 */

export const runtime = 'nodejs'
// The MCP stream is inherently dynamic; never cache or statically optimize it.
export const dynamic = 'force-dynamic'

/**
 * Where the proxy forwards to. Server-only env (no NEXT_PUBLIC) so it can be
 * overridden in deployments without exposing the upstream to the client.
 */
const UPSTREAM_URL = process.env.CANGJIE_MCP_UPSTREAM_URL ?? 'https://cj-mcp.learningman.top/mcp'

/**
 * Request headers worth forwarding upstream. The MCP transport relies on
 * `accept` (json + event-stream negotiation), `content-type`, the session id,
 * the negotiated protocol version, and `last-event-id` for SSE resumption.
 */
const FORWARD_REQUEST_HEADERS = [
  'accept',
  'content-type',
  'mcp-session-id',
  'mcp-protocol-version',
  'last-event-id',
]

/**
 * Response headers worth forwarding back. `mcp-session-id` is the whole point;
 * `content-type` lets the client tell SSE from JSON; `cache-control` keeps the
 * stream uncached.
 */
const FORWARD_RESPONSE_HEADERS = [
  'content-type',
  'mcp-session-id',
  'cache-control',
]

async function proxy(request: Request): Promise<Response> {
  const headers = new Headers()
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(name)
    if (value)
      headers.set(name, value)
  }

  // MCP request bodies are small JSON-RPC envelopes, so buffering the body keeps
  // the proxy simple (no `duplex: 'half'` streaming-upload dance). Responses are
  // streamed back untouched so SSE keeps flowing.
  const body = request.method === 'GET' || request.method === 'HEAD'
    ? undefined
    : await request.text()

  let upstream: Response
  try {
    upstream = await fetch(UPSTREAM_URL, {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
    })
  }
  catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'upstream fetch failed' }),
      { status: 502, headers: { 'content-type': 'application/json' } },
    )
  }

  const responseHeaders = new Headers()
  for (const name of FORWARD_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name)
    if (value)
      responseHeaders.set(name, value)
  }
  // Disable proxy/CDN buffering so the SSE stream is delivered chunk-by-chunk.
  responseHeaders.set('x-accel-buffering', 'no')

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  })
}

export const GET = proxy
export const POST = proxy
export const DELETE = proxy
