# Modal runner deployment

`runner.py` exposes a small authenticated gateway and invokes one fresh,
single-use Modal Function for each `/run` or `/format` request. Every runner
Function:

- uses the canonical `cj-runner` image and protocol;
- keeps the authenticated service as root so its secret is not readable by
  learner processes, while every compiler/formatter/learner process is dropped
  to the unprivileged runner UID before execution;
- has `block_network=True` and no Modal API access;
- is destroyed after exactly one request.

The Go service still owns authentication, request validation, toolchain-lock
verification, compilation, formatting, execution, and resource limits. Modal's
single-use gVisor Function owns the container and blocked-network boundary;
nested Linux namespaces are unavailable there. The runner starts every
compiler, formatter, and learner process through `setpriv` and `prlimit`.

The Modal environment must contain:

- a Secret named `playground-cj-runner-auth` with
  `CJ_RUNNER_SHARED_TOKEN`;
- a Proxy Token used by Vercel through `CJ_RUNNER_MODAL_PROXY_KEY` and
  `CJ_RUNNER_MODAL_PROXY_SECRET`.

Publish the canonical runner image, then deploy the service from the
repository root:

```sh
modal run modal/build_runner_image.py
modal deploy modal/runner.py
```

Set Vercel's `CJ_RUNNER_URL` to the deployed base URL without `/run` or
`/format`. Set the same `CJ_RUNNER_SHARED_TOKEN` on Modal and Vercel.
