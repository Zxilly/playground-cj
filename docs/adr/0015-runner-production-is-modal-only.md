# Runner Production Is Modal-Only

## Decision

Every Playground compile/run request is executed by the Modal deployment in
`modal/runner.py`. The same-origin Next.js gateway accepts only an HTTPS
`*.modal.run` endpoint configured through `CJ_RUNNER_MODAL_URL`. It always
requires Modal Proxy authentication, the internal runner bearer token, and the
checked-in toolchain-lock digest.

The production `cj-runner` process refuses to start unless
`CJ_RUNNER_ENV=production` and
`CJ_RUNNER_ISOLATION_DRIVER=modal-single-use-container`. There is no local
isolation driver or direct deployment mode.

The long-lived runner credential is attached only to the Modal gateway. After
validating it, the gateway generates a per-invocation token for the Go service.
The learner container never receives the long-lived credential.

The runner workflow publishes the Dockerfile-derived image directly into
Modal and deploys the Modal gateway. It does not publish GHCR images or target
Azure Container Apps. The legacy `CJ_RUNNER_URL`, public backend variables,
loopback gateway escape hatch, and arbitrary HTTPS runner targets are not
compatibility surfaces.

## Rationale

A configurable runner target made the effective security boundary depend on
deployment-time convention. The generic path could select a long-lived
container, a locally unauthenticated service, or a platform whose namespace
support differs from the tested production assumptions.

Modal provides the boundary selected for this application: one fresh gVisor
container per request, blocked network access, removed Modal API access,
bounded CPU and memory, and automatic disposal. Encoding that provider in the
configuration name and validating its hostname makes an accidental rollback
to a weaker target fail closed.

## Consequences

Local Next.js development also calls Modal and therefore needs the same four
server-only values as deployed Vercel environments:
`CJ_RUNNER_MODAL_URL`, `CJ_RUNNER_MODAL_PROXY_KEY`,
`CJ_RUNNER_MODAL_PROXY_SECRET`, and `CJ_RUNNER_SHARED_TOKEN`.

Developers may still run Go unit tests directly, but the runner process itself
requires the Modal marker and the frontend gateway never routes learner source
to a local service. A future provider change requires a new architecture
decision and explicit protocol/security review rather than an
environment-variable swap.

GitHub Actions requires repository secrets `MODAL_TOKEN_ID` and
`MODAL_TOKEN_SECRET` for continuous deployment. The Modal application secret
`playground-cj-runner-auth` and the Vercel secrets remain independently scoped.
