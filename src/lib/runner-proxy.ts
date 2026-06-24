/**
 * Server-side proxy to the Cangjie runner. The browser POSTs to same-origin
 * `/api/run` and `/api/format`; these forward to the runner so the runner URL
 * stays server-only (no `NEXT_PUBLIC_`) and the runner needs no CORS — which the
 * Azure Container Apps Express runner can't emit (CORS is still in development).
 *
 * `CJ_RUNNER_URL` selects the runner; it falls back to the legacy public default
 * so a deploy without the env set keeps working against the old backend.
 */
// `||` (not `??`) so an empty-string env var also falls through to the next
// candidate — an accidentally-blank CJ_RUNNER_URL degrades to the legacy backend
// rather than producing a broken relative fetch.
const RUNNER_URL = process.env.CJ_RUNNER_URL
  || process.env.NEXT_PUBLIC_BACKEND_URL
  || 'https://cj-api.learningman.top'

export async function proxyToRunner(request: Request, action: 'run' | 'format'): Promise<Response> {
  const body = await request.text()
  const contentType = request.headers.get('content-type') ?? 'text/plain; charset=utf-8'

  let upstream: Response
  try {
    upstream = await fetch(`${RUNNER_URL}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
    })
  }
  catch (error) {
    return Response.json(
      { error: `runner unreachable: ${error instanceof Error ? error.message : String(error)}` },
      { status: 502 },
    )
  }

  // Pass the runner's response straight through (status + JSON body) so the
  // existing client contract (RunMessage / FormatMessage, error text) is intact.
  const text = await upstream.text()
  return new Response(text, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
  })
}
