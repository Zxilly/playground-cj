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
and sandbox probes, reproducible image inputs, and the tested build/deploy
workflow. Compiler and learner processes run in fresh bubblewrap
user, mount, network, PID, UTS, and IPC namespaces with a minimal filesystem,
fixed environment, bounded writable tmpfs mounts, rlimits, and no unsandboxed
fallback.

Source formatting is outside the runner contract. The browser downloads the
versioned `cjfmt` WASM asset from the same immutable archive as the language
server and formats locally, so formatting neither starts a remote container nor
consumes compiler admission capacity.

## Consequences

This removes duplicated security-sensitive code and prevents the two backends
from silently drifting in protocol, toolchain, and failure semantics.

The replacement is not equivalent to a fresh Docker container. The Linux
kernel, the runner replica, bubblewrap, the dynamic loader, and the Cangjie
toolchain remain trusted. A bad request may exhaust or crash its single-flight
replica, so the deployment must provide replica-level CPU, memory, PID, and
ephemeral-storage quotas and restart unhealthy replicas. A target that cannot
run the startup namespace probe is unsupported and must remain unhealthy.

If a deployment later requires VM isolation or a fresh container for every
request, it must add an outer supervisor around the same authenticated runner
contract and locked image. Restoring the old agent protocol, weakening the
startup probe, or adding a direct-execution fallback is not an accepted
compatibility strategy.

Production subsequently standardized on the single-use Modal boundary. The
provider-specific constraints and removal of the generic runner target are
recorded in [ADR 0015](./0015-runner-production-is-modal-only.md).
