# Runner Backends Are Consolidated

## Decision

The repository supports one compile and run contract implemented by
`cj-runner/cmd/runner` and reached through the authenticated same-origin Next.js
gateway. The former `server/` Docker-per-request backend is removed instead of
being retained as a compatibility path.

The old backend gave each request a fresh container with no network, a PID
limit, memory and CPU limits, and `no-new-privileges`. Its resident control
plane nevertheless held root-equivalent Docker socket authority. Its public
HTTP boundary allowed every origin, had no service authentication or body
limit, returned a divergent output/error contract, installed the toolchain
through mutable `cjv latest` and mirror inputs, and was not built by the
repository's deployment workflow.

`cj-runner` now owns the canonical request and response schemas, shared-token
authentication, exact toolchain-lock handshake, request and output bounds,
disconnect cancellation, infrastructure-failure semantics, startup toolchain
verification, reproducible image inputs, and the tested build/deploy workflow.
Compiler and learner processes run in one fresh Modal container per request
with a fixed environment, blocked network, bounded resources, and automatic
disposal.

Source formatting is outside the runner contract. The browser downloads the
versioned `cjfmt` WASM asset from the same immutable archive as the language
server and formats locally, so formatting neither starts a remote container nor
consumes compiler admission capacity.

## Consequences

This removes duplicated security-sensitive code and prevents the two backends
from silently drifting in protocol, toolchain, and failure semantics.

The Linux kernel, Modal runtime, dynamic loader, and Cangjie toolchain remain
trusted. A bad request may exhaust or crash its single-use container, so the
deployment must provide CPU, memory, process, and ephemeral-storage limits and
discard unhealthy workers.

If the deployment provider changes, the replacement must preserve the same
fresh-container boundary around the authenticated runner contract and locked
image. Restoring the old agent protocol or adding a generic direct runner is
not an accepted compatibility strategy.

Production subsequently standardized on the single-use Modal boundary. The
provider-specific constraints and removal of the generic runner target are
recorded in [ADR 0015](./0015-runner-production-is-modal-only.md).
