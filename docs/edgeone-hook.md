# EdgeOne Turbopack compatibility hook

EdgeOne CLI 1.6.45 bundles `@edgeone/opennextjs-pages@0.2.10-beta.12`.
Its middleware compiler does not handle Next 16.4's nested strict factory
groups. `scripts/edgeone-compat-hook.mjs` registers a synchronous Node
`module.registerHooks({ load })` hook, enabled explicitly with `--import`.
It transforms the compiler module in memory without rewriting `node_modules`
or application chunks. Turbopack remains enabled.

The hook resolves the adapter from `EDGEONE_CLI_DIRECTORY`, verifies both
package names and exact versions, and matches the compiler's canonical file
URL. The pure transform in `scripts/edgeone-turbopack-compat.mjs` checks the
original factory-installer function hash and preserves factory identity across
aliases. Other modules pass through unchanged. Unknown versions or function
implementations throw an error rather than applying an unreviewed transform.

## Invocation

Use Node 24.14 or newer in the Node 24 line; CI uses Node 24. The public
[synchronous module hook API](https://nodejs.org/api/module.html#moduleregisterhooksoptions)
is currently marked stability 1.2 (release candidate).

```sh
npm install --prefix "$RUNNER_TEMP/edgeone-cli" --no-package-lock --no-audit --no-fund edgeone@1.6.45
export EDGEONE_CLI_DIRECTORY="$RUNNER_TEMP/edgeone-cli/node_modules/edgeone"

node --import ./scripts/edgeone-compat-hook.mjs \
  "$EDGEONE_CLI_DIRECTORY/edgeone-bin/edgeone.js" makers deploy \
  --name "$EDGEONE_PROJECT_NAME" --area global --env production \
  --skip-ai-gateway-sync

node --import ./scripts/edgeone-compat-hook.mjs \
  scripts/verify-edgeone-middleware.mjs "$EDGEONE_CLI_DIRECTORY"
node scripts/verify-edgeone-deployment.mjs https://play.cj.zxilly.com
```

Run these commands from the repository root after authenticating the CLI.
The CLI launcher forwards its Node arguments to its child, so `--import` also
registers the hook in the process that loads the adapter. The separate
middleware verification process needs its own `--import`. Do not set global
`NODE_OPTIONS`: only EdgeOne compilation commands need this compatibility layer.
The compiler load emits an `[edgeone-compat]` line for deployment log inspection.

## Validation and upgrades

```sh
pnpm exec vitest run --project unit tests/scripts/edgeone-turbopack.test.mts tests/scripts/edgeone-hook.test.mts
```

The regression tests cover nested groups, aliases, offsets, malformed chunks,
changed source, explicit package selection, version rejection, child-process
inheritance, module isolation, and unchanged installed files. Deployment still
executes eight cases against compiled application middleware, then checks both
public locales, isolation headers, language redirects, and the API origin guard.

When updating the CLI, inspect its actual adapter dependency and factory
implementation before changing the pinned versions or expected function hash.
Test a clean installation with and without the hook. If the upstream compiler
passes the same middleware cases unaided, remove the hook and its explicit
preload arguments while retaining the compiled and public deployment checks.
This compatibility layer does not replace an upstream fix.
