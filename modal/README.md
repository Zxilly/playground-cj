# Modal runner deployment

`runner.py` handles `/run` requests in single-use Modal containers.

## Configuration

- Modal secret `playground-cj-runner-auth`: `CJ_RUNNER_SHARED_TOKEN`
- Vercel: `CJ_RUNNER_MODAL_URL`, `CJ_RUNNER_MODAL_PROXY_KEY`,
  `CJ_RUNNER_MODAL_PROXY_SECRET`, and the same `CJ_RUNNER_SHARED_TOKEN`
- GitHub Actions: `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET`

## Deploy

Publish the canonical runner image, then deploy the service from the
repository root:

```sh
modal run modal/build_runner_image.py
modal deploy modal/runner.py
```

Use the deployed base URL without `/run` for `CJ_RUNNER_MODAL_URL`. Production
deployments are automated by `.github/workflows/deploy-runner.yml`.
