# Modal runner deployment

`runner.py` exposes a small authenticated gateway and invokes one fresh,
single-use Modal Function for each `/run` request. Every runner
Function:

- uses the canonical `cj-runner` image and protocol;
- receives a new random bearer token that is valid only inside that invocation;
- runs the service, compiler, and learner as the image's unprivileged UID;
- has `block_network=True` and no Modal API access;
- is destroyed after exactly one request.

The Go service still owns its per-invocation authentication, request validation,
toolchain-lock verification, compilation, output bounds, cancellation, and
wall-clock deadlines. Modal's
single-use gVisor Function owns the container and blocked-network boundary;
nested Linux namespaces and resource wrappers are neither required nor used.

The Modal environment must contain:

- a Secret named `playground-cj-runner-auth` with the long-lived
  `CJ_RUNNER_SHARED_TOKEN`, attached only to the gateway;
- a Proxy Token used by Vercel through `CJ_RUNNER_MODAL_PROXY_KEY` and
  `CJ_RUNNER_MODAL_PROXY_SECRET`.

Publish the canonical runner image, then deploy the service from the
repository root:

```sh
modal run modal/build_runner_image.py
modal deploy modal/runner.py
```

Set Vercel's `CJ_RUNNER_MODAL_URL` to the deployed base URL without `/run`.
Set the same `CJ_RUNNER_SHARED_TOKEN` on Modal and Vercel. The Next.js gateway
accepts only `*.modal.run` targets and always requires the Proxy Token.

Production deployment is owned by
`.github/workflows/deploy-runner.yml`. Configure the repository secrets
`MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET`; pushes to `master` that change
`cj-runner/`, `modal/`, or the workflow publish the image directly to Modal and
then deploy the gateway. GHCR and Azure Container Apps are not part of the
deployment path.
