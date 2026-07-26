# Runner admission uses trusted infrastructure and distributed limits

The same-origin `/api/run` route exposes expensive compiler capacity. `Origin`
and Fetch Metadata can reject browser CSRF, but a direct HTTP
client can forge both values. They are therefore not an identity boundary.
Likewise, a counter inside one Next.js process cannot limit a multi-replica
deployment.

Before reading a request body or contacting `cj-runner`, the proxy resolves a
client IP supplied by trusted infrastructure and atomically consumes both an
identity bucket and a deployment-wide bucket in Redis. Vercel's overwritten
`x-vercel-forwarded-for` is trusted. A self-hosted reverse proxy must strip the
public value and overwrite the header named by
`AI_GATEWAY_TRUSTED_IP_HEADER`. Production fails closed when that identity
boundary, Redis credentials, or explicit runner rate limits are absent.

The per-process bulkhead remains a separate, earlier resource bound around the
Redis call, request body, upstream fetch, and upstream response. A deadline can
stop the HTTP handler from waiting, but does not release the slot while a raw
Redis, stream, fetch, or cancellation operation is still unsettled. Distributed
quota exhaustion returns `429`; unavailable identity/admission infrastructure
and local bulkhead saturation return `503`. Admission and body sub-deadlines
remain bounded by a 28-second total request deadline so the 30-second route
budget retains time to finalize the response.

Every production I/O boundary receives the same request-owned cancellation:
the Upstash client is created per signalled Redis operation, runner `fetch`
receives the combined deadline signal, and request/response stream readers
cancel their underlying Web Streams. Cancellation is also an admission state,
not merely an error returned to one caller. As soon as any raw operation is
still pending after its signal aborts, the process stops accepting replacement
runner work. If the operation settles within the one-second cancellation grace,
admission reopens without releasing its slot early.

There is no safe in-process recovery from a promise that permanently violates
its cancellation contract. Releasing its slot would let an attacker accumulate
an unbounded number of zombie Redis, socket, or stream operations; retaining
four such slots forever would strand the instance. The proxy therefore crosses
a fail-stop boundary after the grace period: the circuit stays closed and a
production process exits so its platform or supervisor replaces the instance.
At no point is a timed-out slot reused. Existing requests remain bounded by the
four-slot bulkhead, and no new request enters after cancellation becomes
unsettled. Vercel supplies the instance-replacement boundary; self-hosted
deployments must use a process supervisor or container restart policy.
