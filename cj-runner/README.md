# Cangjie runner

`cmd/runner` builds the compile/run process embedded in the Modal production
boundary behind the Next.js `/api/run` gateway. There is intentionally no
second production runner implementation or configurable provider fallback.
Do not expose this process as a public API.

## Where it runs

`cj-runner` does not run in the browser, the Next.js process, or a Vercel
Function. Production invokes it only through `modal/runner.py`: one fresh
single-use gVisor container per request, with network access blocked and Modal
API access removed. The long-lived bearer credential is attached only to the
Modal gateway. After validating it, the gateway creates a new random token for
the single worker invocation; that token expires with the container.

There is no local or generic deployment mode. Local frontend development calls
the same Modal endpoint as production. Go unit tests can run under Linux/WSL,
but starting the runner requires the explicit Modal isolation marker.

## Why the old `server/` backend was removed

The removed backend was not just another entry point. Its long-lived HTTP
process mounted the Docker control socket and created a fresh agent container
for each request. That gave each request a container boundary, but the control
plane itself had root-equivalent Docker authority. It also had an independently
evolving protocol and image:

- permissive cross-origin access, no service-to-service authentication, and no
  request-body limit at the HTTP boundary;
- combined learner output and infrastructure errors that could not satisfy the
  canonical runner contract;
- a mutable `cjv latest` toolchain path and mutable package mirrors instead of
  the checked-in toolchain lock;
- no repository workflow that built and verified the same image later deployed.

Keeping both implementations would require every protocol, cancellation,
toolchain, supply-chain, and isolation fix to be implemented and tested twice.
The repository therefore supports one gateway contract and one Modal runner
image. See [`ADR 0014`](../docs/adr/0014-runner-backends-are-consolidated.md)
and [`ADR 0015`](../docs/adr/0015-runner-production-is-modal-only.md).

## Required deployment configuration

- `CJ_RUNNER_SHARED_TOKEN`: a 32–512 byte printable-ASCII bearer token. Modal
  supplies a newly generated value to each single-use worker; the long-lived
  deployment credential is never attached to that worker.
- `CJ_RUNNER_ENV`: must be `production` (the image default).
- `CJ_RUNNER_ISOLATION_DRIVER`: must be
  `modal-single-use-container`; `modal/runner.py` sets it.
- `PORT`: optional listener port; default `8000`.

Set the same long-lived `CJ_RUNNER_SHARED_TOKEN` on the Modal gateway and
Next.js deployment. Rotate both deployments together. The token must remain
server-only and must never use a `NEXT_PUBLIC_` name. Configure `CJ_RUNNER_MODAL_URL`,
`CJ_RUNNER_MODAL_PROXY_KEY`, and `CJ_RUNNER_MODAL_PROXY_SECRET` on the Next.js
deployment. The gateway refuses every non-Modal target and never omits either
authentication layer.
The Next.js gateway also sends the canonical checked-in toolchain-lock digest on every
request. A stale runner image rejects the request before reading its body.

## Compiler and learner execution boundary

Before opening its loopback listener, `cj-runner` strictly parses the bundled
toolchain lock, checks its installer marker, re-hashes `/cangjie/bin/cjc`, and
checks the compiler's reported backend and target. A stale or modified
toolchain terminates the worker.

The Modal Function is the security and resource boundary. It is configured with
`single_use_containers=True`, `block_network=True`,
`restrict_modal_access=True`, one CPU, 4096 MiB memory, and a 30-second
deadline. A worker handles exactly one request and is then destroyed, so
compiler and learner processes cannot share a container with another request.
The final image and every child process run as UID/GID `65532`.

Within that boundary, the Go service:

- creates one private request directory and gives `cjc` only an explicit,
  fixed environment without service credentials;
- executes the compiled program in the same request directory with another
  fixed environment;
- never invokes a shell or nested namespace/resource wrapper;
- caps each output channel at 1,000,000 UTF-8 bytes;
- propagates cancellation, kills the whole child process group, and applies
  compiler and learner wall-clock deadlines.

Modal owns CPU, memory, network, filesystem, process, and container-lifetime
limits. The Go service intentionally does not duplicate those controls with a
second isolation implementation. A pathological program can exhaust its own
single-use worker, but it cannot be co-located with a different request.

## HTTP boundary

- `POST /run` accepts `text/plain; charset=utf-8` or a strict
  `application/json` object containing `code` and optional `stdin`.
- The endpoint requires the shared bearer token and exact toolchain-lock
  digest, caps request bodies at 256 KiB, propagates disconnect cancellation
  into compiler processes, and enforces operation and HTTP server timeouts.
- A digest mismatch returns `503 runner_toolchain_mismatch` with
  `X-Playground-Cangjie-Toolchain-Status: mismatch`; the gateway uses that
  explicit signal to distinguish a stale deployment from an ordinary upstream
  `503` without exposing the upstream response body.
- `GET /` is an unauthenticated, non-cached health check and exposes no runner
  capability.

`POST /run` returns three distinct output channels:

- `compiler_output` contains only compiler diagnostics.
- `bin_stdout` and `bin_stderr` contain only the executed program's respective
  streams. They are never merged.
- `compiler_output_truncated`, `bin_stdout_truncated`, and
  `bin_stderr_truncated` are required booleans. Truncation is never encoded as
  text inside an output channel.
- `phase` is `compile` with a non-zero `compiler_code` and `bin_code: null`
  when no binary ran; otherwise it is `run`, `compiler_code` is zero, and
  `bin_code` is an integer.

Each output channel is capped at 1,000,000 UTF-8 bytes. Content remains pure;
the corresponding boolean is the only truncation signal.

Filesystem setup, source write/read, tool start, and
compiler deadline failures are infrastructure failures. They return
HTTP `503` with code `runner_infrastructure_failure`, never a normal compile or
run result. Learner compile diagnostics and learner process exit codes remain
HTTP `200`. This distinction prevents an unavailable runner from being
mistaken for learning evidence.

The 256 KiB request cap intentionally matches `MAX_RUNNER_REQUEST_BYTES` in
`src/lib/runner-proxy.ts`; changing either boundary requires changing and
testing both.

Formatting is intentionally not an HTTP runner operation. The frontend loads
`cjfmt` from the versioned browser WASM archive and formats locally, without
starting a Modal container or consuming runner admission capacity.

## Reproducible toolchain inputs

The Docker build does not execute an unpinned version-manager download:

- `golang:1.26` is pinned to image-index digest
  `sha256:3aff6657219a4d9c14e27fb1d8976c49c29fddb70ba835014f477e1c70636647`.
- `debian:12-slim` is pinned to image-index digest
  `sha256:7b140f374b289a7c2befc338f42ebe6441b7ea838a042bbd5acbfca6ec875818`.
- Debian packages come from the immutable
  `20260725T000000Z` Debian and Debian Security snapshots, with Release-file
  freshness checks disabled only because historical snapshots are immutable.
- `cangjie-toolchain.lock.json` is the single source for the Cangjie SDK,
  extracted `cjc`, and stdx release identities and SHA-256 digests.
- `install-cangjie-toolchain.sh` is shared by Docker and CI. It verifies both
  archives, the extracted compiler bytes, and the compiler backend/target. It
  accepts only regular cache files, extracts into a private empty staging
  directory, and refuses to merge into an existing or concurrently created SDK
  or stdx target.

To update, choose a specific upstream release, download the exact SDK and stdx
assets independently, verify their archive structure, compute SHA-256, and
change the lock in one reviewed change. Never replace a digest merely to make
a failed build pass. The alignment gate ensures Docker, CI, `cjpm.toml`, and
the current Content Pack receipt all remain bound to that lock.
