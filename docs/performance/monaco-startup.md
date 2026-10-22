# Monaco module graph and first-edit latency

This follow-up compares the production build at `64add8e` with the editor
changes in `8f8d699`, measured on 2026-10-22 before committing. Both builds use
Turbopack and Monaco/VS Code 38.0.3.
The earlier [startup report](./playground-startup.md) covers fonts, server-rendered
previews, and the dependency upgrade; its timings are a separate experiment.

## Changes

- Defer `vscode/localExtensionHost` and the extension API until there is a live
  language-server port. The model mirror writes through the existing file
  service, and the Cangjie grammar extension has only declarative contributions.
  A small browser extension supplies the public VS Code API when the language
  client starts. Initialization is shared across editors and server restarts.
- Remove the unused workbench `ViewsService` branch. All callers use the
  standalone editor. Remove its dependency and the native workbench status-bar
  dependency; the application still renders its LSP control in a responsive
  footer with the same theme variables.
- Generate the Chinese VS Code catalog from numeric localization calls in
  every installed Monaco/VS Code package, including deferred modules. Keep
  13,895 of 25,290 messages at their original indexes. The JSON falls from
  1,003,171 to 591,101 bytes before compression. The generator copies retained
  translations verbatim, requires matching package versions, and rejects
  unknown dynamic indexes. It runs explicitly in `predev` and `prebuild`.
  Chinese localization still finishes before the editor runtime evaluates.

The extension-host branch contains chat, terminal, source-control, debug, and
authentication APIs. The application does not use those capabilities directly,
but the upstream language client imports the shared VS Code API. Deferring the
branch avoids loading it before editing; it does not remove it from the eventual
language-client payload. Removing unused views also eliminates a dormant build
branch, so its entire bundle size is not counted as a first-edit saving.

TextMate tokenization, themes, configuration, models, language services, the
editor service, and extension registration remain. The default theme extension
and declarative Cangjie syntax extension remain active. Replacing these with
stubs would require additional compatibility work and is outside this change.

## Measurement

Run a production server and use:

```sh
STARTUP_VARIANT=baseline node scripts/measure-editor-startup.mjs http://127.0.0.1:3100 baseline.json
STARTUP_VARIANT=pruned node scripts/measure-editor-startup.mjs http://127.0.0.1:3100 pruned.json
```

The probe uses a fresh browser context for each sample, disabled cache, 40 ms
network latency, 10 Mbps, 4x CPU throttling, and a 1440x900 viewport. It observes
editor text, enters a marker and verifies it in the rendered model, then waits
for the actual language server and requests a type diagnostic. Input and
diagnostic timings include browser automation overhead. Resource totals include
completed page JavaScript before the editor appears, excluding workers.

The measurements use Chromium 156.0.8078.4 for every variant. Each baseline and
intermediate variant has three samples per locale. These small local samples
show the observed change, not a guarantee for production devices or networks.

The final result combines two rounds (six samples per locale). Times below are
medians; MB uses decimal bytes. All samples, including slow runs, are retained
in the [measurement record](./monaco-startup-2026-10-22.json).

| Metric | English before | English after | Chinese before | Chinese after |
| --- | ---: | ---: | ---: | ---: |
| Editor text visible | 5.317 s | 5.153 s | 6.056 s | 5.484 s |
| First input verified | 6.026 s | 5.956 s | 7.043 s | 6.311 s |
| JavaScript transferred before visible | 2.630 MB | 2.425 MB | 2.928 MB | 2.580 MB |
| JavaScript decoded before visible | 9.864 MB | 9.094 MB | 10.896 MB | 9.691 MB |
| First type diagnostic observed | 29.140 s | 29.785 s | 30.309 s | 30.163 s |

Chinese first input improved by 0.732 s (10.4%) in this comparison. The English
change is only 0.070 s (1.2%), too small to claim a meaningful speedup from these
samples. The final input ranges are 5.807–6.940 s in English and 5.758–6.697 s in
Chinese. The consistent payload reductions are 205,372 bytes (7.8%) and 347,434
bytes (11.9%) respectively. The deferred-host-only experiment accounts for
165,065 transferred bytes; removing the workbench status bar saves another
14,299 bytes. The final view and localization cleanup accounts for the rest.

The large WASM language server remains a separate startup cost. Its first
diagnostic does not improve materially; the English diagnostic arrived 0.645 s
later in these samples. Editor usability and full code assistance must be
reported separately. Deferring the host reduces work before editing but still
incurs that work when code assistance starts.

## Module graph reproduction

```sh
pnpm exec next experimental-analyze --output --snapshot monaco
pnpm exec next experimental-analyze export --snapshot monaco --route '/[lang]' > monaco.jsonl
node scripts/summarize-monaco-graph.mjs monaco.jsonl
```

The summary follows synchronous imports from the client `EditorWrapper` and
deduplicates analyzer parts by output filename and source path. Analyzer bytes
and browser transfer bytes have different meanings and are reported separately.

The synchronous closure falls from 2,646 to 2,507 modules. Before the change,
131 modules (727,398 analyzer bytes) were exclusive to the extension-host/API
branch. After the change, none of that branch is in this synchronous closure.
The remaining large modules include the upstream service stubs, editor option
definitions, TextMate, and editor widgets. Many are shared by features retained
here; they are not independent unused extensions that can simply be deleted.

## Compatibility checks

The production browser test exercises real Cangjie completion with word-based
suggestions disabled, type diagnostics, WASM formatting, Chinese context menus,
and stopping/restarting the language server followed by another diagnostic.
It also verifies that the local extension host starts after editor readiness.
The other production checks cover both locales, server-rendered previews,
shared source, layout shift, deferred controls, and bounded font fallback.

The localization generator has tests for imported aliases, namespace imports,
false matches in comments/strings, dynamic-index rejection, preserved indexes,
and catalog bounds. Browser component tests verify file mirroring through the
file service without eagerly importing the extension API.

## EdgeOne compatibility hook

The deployment compatibility layer is separate from these editor changes.
CI installs EdgeOne CLI 1.6.45 and preloads a Node module hook that checks
the CLI version, adapter `0.2.10-beta.12`, and original factory-installer
function hash. It transforms only the selected compiler module in memory to
support Next 16.4's nested strict Turbopack factory groups and aliases.

Installed dependencies are never rewritten. Unknown package versions or source
changes fail the build. Both deployment and the separate compiled-middleware
verification explicitly enable the hook; no global `NODE_OPTIONS` is needed.
Twelve regression tests cover factory registration and hook isolation, followed
by eight checks against the compiled application middleware and live HTTP checks.
Turbopack remains enabled. See the [hook operations guide](../edgeone-hook.md)
for commands and the upgrade procedure.
