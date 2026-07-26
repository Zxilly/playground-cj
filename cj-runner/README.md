# Cangjie runner

`cmd/runner` builds the `cj-runner` compile/run service behind the Next.js
`/api/run` gateway, for both managed and self-hosted
deployments. Build and deploy this directory's image; there is intentionally no
second runner implementation with a weaker or divergent boundary. Do not expose
it as an unauthenticated public API.

## Where it runs

`cj-runner` is a separate Linux service. It does not run in the browser, the
Next.js process, or a Vercel Function. A standard long-lived deployment runs
the image built from this directory on a container platform with:

- an unprivileged Linux user that may create the bubblewrap namespaces verified
  by the startup probe;
- replica-level CPU, memory, PID, and ephemeral-storage limits plus automatic
  restart of unhealthy replicas;
- HTTPS reachability from the Next.js deployment, preferably over private
  ingress. If public ingress is unavoidable, the shared-token boundary remains
  mandatory and no browser calls the runner directly.

Set the Next.js service's `CJ_RUNNER_URL` to that container endpoint. Production
currently invokes the image through the single-use Modal Function defined in
`modal/runner.py`: one fresh gVisor container per request, with network access
blocked and Modal API access removed. Modal Proxy authentication is required
before the request reaches the runner; the runner's own shared-token and
toolchain-lock checks remain mandatory behind that boundary.

For local development, run the image with Docker on Linux/WSL, or build
`./cmd/runner` inside Linux and bind it to loopback with
`CJ_RUNNER_ENV=development`. It is intentionally Linux-only because its
security boundary depends on bubblewrap and Linux namespaces.

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
toolchain, supply-chain, and sandbox fix to be implemented and tested twice.
The repository therefore supports one gateway contract and one runner image.
This is a deliberate replacement of the Docker-per-request architecture, not a
claim that a bubblewrap process boundary is identical to a fresh container.
Self-hosted deployments must meet the namespace and replica-level resource
requirements below. If a future deployment requires VM or per-request-container
isolation, it should wrap this same authenticated runner contract and locked
image instead of restoring the old agent protocol. See
[`ADR 0014`](../docs/adr/0014-runner-backends-are-consolidated.md).

## Required deployment configuration

- `CJ_RUNNER_SHARED_TOKEN`: a 32–512 byte printable-ASCII bearer token shared
  only with the Next.js service. The production process refuses to start if it
  is absent or malformed.
- `CJ_RUNNER_ENV`: `production` (the image default), `development`, or `test`.
  Only explicit development/test mode may start without a token.
- `CJ_RUNNER_ISOLATION_DRIVER`: omit for the standard bubblewrap boundary.
  The exact value `modal-single-use-container` is reserved for the production
  Modal Function in `modal/runner.py`; other values and non-production use are
  rejected.
- `PORT`: optional listener port; default `8000`.

Set the same `CJ_RUNNER_SHARED_TOKEN` secret on the Next.js deployment. Rotate
both deployments together. The token must remain server-only and must never use
a `NEXT_PUBLIC_` name. Configure `CJ_RUNNER_URL` with the runner's HTTPS
endpoint; the gateway accepts plaintext HTTP only for loopback development.
For a Modal endpoint, also configure `CJ_RUNNER_MODAL_PROXY_KEY` and
`CJ_RUNNER_MODAL_PROXY_SECRET` on the Next.js deployment. The gateway refuses
to call a `*.modal.run` URL without both credentials.
The gateway also sends the canonical checked-in toolchain-lock digest on every
request. A stale runner image rejects the request before reading its body.

For local development without authentication, run the service with
`CJ_RUNNER_ENV=development` and leave `CJ_RUNNER_SHARED_TOKEN` unset. This is an
explicit local-only escape hatch: the process binds to `127.0.0.1` instead of
all interfaces. The production image remains fail-closed.

## Compiler and learner execution boundary

Before opening its listener, `cj-runner` strictly parses the bundled toolchain
lock, checks its installer marker, re-hashes `/cangjie/bin/cjc`, checks the
compiler's reported backend and target, and exercises the selected execution
profile by compiling and running a minimal source file. A stale
toolchain or failed profile terminates the service.

For the single-use Modal profile, startup performs the same toolchain identity
checks plus a lightweight dropped-UID process probe. It does not compile a
second sample program before the real request because the container is never
reused; the request itself exercises the selected compiler path.

The default profile runs the HTTP service as UID/GID `65532` and places every
`cjc` and learner process behind bubblewrap with:

- fresh user, mount, network, PID, UTS, and IPC namespaces;
- an empty root containing only read-only `/usr`, `/bin`, `/lib`, `/lib64`,
  `/cangjie`, and `/linux_x86_64_cjnative` mounts;
- private `/proc` and `/dev` instances plus size-bounded tmpfs mounts: 32 MiB
  for `/tmp` and 96 MiB for `/work`;
- no inherited environment. Only fixed runtime values for `PATH`,
  `CANGJIE_HOME`, `LD_LIBRARY_PATH`, locale, `HOME`, and `TMPDIR` are added;
- no network namespace egress, no retained capabilities, nested user namespace
  creation disabled, per-process rlimits, a wall-clock deadline, and bounded
  stdout/stderr.

The compiler sees exactly one writable bind at `/request`: the current
request's mode-`0700` directory. Sibling request directories and the rest of
host `/playground` are not mounted. A learner binary instead receives only its
own executable, read-only at `/app/main`, and can write only to its private
tmpfs mounts. `cjc` remains trusted for semantic correctness, but untrusted
source does not grant it the service process's filesystem, network, PID view,
or environment.

The Modal profile is explicit rather than a fallback. Modal starts the
authenticated service as root, but each compiler and learner process is
launched through `setpriv` as UID/GID `65532`, with all capabilities
removed, `no_new_privs`, fixed environment, wall-clock deadlines, `prlimit`
resource bounds, and capped output. The root service keeps the bearer secret
inaccessible to learner processes. The surrounding Function is configured with
`single_use_containers=True`, `block_network=True`,
`restrict_modal_access=True`, and one invocation per container, so it supplies
the filesystem, process, user, and network boundary. Modal does not permit
nested namespaces.

Admission is fixed at one operation per replica. Per-process rlimits and the
default profile's tmpfs sizes are defense in depth, not a replacement for
deployment isolation: the deployment must impose replica-level memory, PID,
CPU, and ephemeral-storage cgroup/quotas. A pathological request can still
exhaust or crash its own replica; single-flight ensures it cannot share that
replica concurrently with another tenant.

The default boundary depends on Linux user namespaces and bubblewrap, not on a claim
that every container host supports them. A self-hosted or managed platform must
allow an unprivileged UID to create the namespaces and mounts used by
bubblewrap (for example, `kernel.unprivileged_userns_clone` must not disable
them and the container seccomp/AppArmor policy must permit them). If an Azure
Container Apps plan or any other target denies those operations, the image is
not compatible with that target and intentionally remains unhealthy. Do not
weaken the probe or add an implicit unsandboxed fallback. Use the explicit
Modal driver only inside the single-use Function defined in this repository.

For the default profile, do not place deployment secret volumes below paths
exposed read-only to bubblewrap (`/usr`, `/bin`, `/lib`, `/lib64`, `/cangjie`,
or `/linux_x86_64_cjnative`). Environment-backed secrets are preferred.

## HTTP boundary

- `POST /run` accepts `text/plain; charset=utf-8` or a strict
  `application/json` object containing `code` and optional `stdin`.
- The endpoint requires the shared bearer token and exact toolchain-lock
  digest, cap request bodies at 256 KiB, cap concurrent work, propagate
  disconnect cancellation into compiler processes, and enforce
  operation and HTTP server timeouts.
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

Filesystem setup, source write/read, tool start, namespace setup, and
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
