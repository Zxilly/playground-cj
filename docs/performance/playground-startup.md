# Playground startup measurements

Measured on 2026-10-22 against a local production server. The comparison starts
at `9d628fd`, after the Lingui-driven font subsets and route CSS split.

## Reproduce

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm exec next start -p 3100
# In another terminal:
node scripts/measure-playground-load.mjs http://127.0.0.1:3100 .scratch/startup.json
```

The harness uses Chromium with a cold cache, 40 ms latency, 10 Mbps download,
4x CPU throttling, and 1440/390 px viewports. It runs three samples for each
locale/width pair. Font loading and layout shifts are observed through two
seconds after editor/font readiness. A subsequent typing probe verifies that
the editor accepts input; its round-trip includes browser automation overhead
and is not an input latency or startup metric.

`editor` records the first rendered Monaco line. `editorReady` is the application's
editor callback, before the status bar finishes. Neither means the language
server is ready. Resource totals exclude worker subresources and unfinished
requests. Initial shell JS counts the initial document's `script[src]` entries,
not all scripts downloaded before the editor becomes usable.

## Payload

| Initial shell | Before | After | Change |
| --- | ---: | ---: | ---: |
| JS, encoded bytes | 208,619 | 195,373 | -6.3% |
| JS, decoded bytes | 676,203 | 641,140 | -5.2% |
| CSS, encoded bytes | 16,680 | 16,692 | +12 bytes |
| CSS, decoded bytes | 94,074 | 93,224 | -0.9% |

The dependency upgrade alone increased initial JS to 218,580 encoded bytes.
Deferring the language, example, and share popover implementation reduced that
intermediate result by 23,207 bytes (10.6%). Hover/focus starts loading; activation
mounts the interactive popover. The initial button remains server rendered.

Fonts remain 190,960 bytes for the default Chinese page and 63,452 bytes for
English. Both final measurement rounds had zero CLS and no page errors.

## Critical path

The largest remaining cost is the Monaco/VS Code module graph. A final English
sample completed 2,629,003 encoded JS bytes (9,863,024 decoded bytes) before the
editor appeared. Chinese completed 2,926,655 encoded JS bytes (10,895,234 decoded
bytes). The largest single runtime chunk is 699,234 encoded / 2,626,446 decoded
bytes. These totals include the shell and other completed page scripts.

The original CPU profile showed long tasks of roughly 1.2–1.35 seconds after
runtime downloads. Module evaluation dominated the sampled startup stack;
editor DOM measurement was another visible cost. Moving small toolbar controls
off the initial shell does not remove this runtime work.

The changes in this round address two measured serial waits:

- Start language, TextMate, theme, editor, extension services, and the default
  theme imports alongside the editor import. The measured wait from
  `services-start` to `overrides-loaded` fell from about 190 ms to about 1 ms in
  the controlled pre-upgrade probe. Downloads and evaluation still have costs;
  they now overlap the initial module load.
- Signal editor readiness before awaiting the status bar. Earlier profiles
  spent about 190–280 ms between editor creation and the ready callback. A
  regression test holds status bar creation pending and verifies both editor
  readiness and cleanup after unmount.

The measurements in this section precede the [module-graph follow-up](./monaco-startup.md),
which defers the extension host and generates a smaller Chinese catalog.

Chinese localization must still execute before importing the VS Code runtime.
Its approximately 297 KB compressed catalog introduces a roughly 300–360 ms
serial step in the original profiles. Changing evaluation order breaks Chinese
menus. The local extension host is also part of the current VS Code services,
model synchronization, and language-client integration, so it was retained.

Full startup times vary across runs; the included measurement summary preserves
both final rounds, including slow samples. These data do not establish a stable
end-to-end speedup. The payload reduction and removal of the two serial waits
are supported separately from that timing claim.

Medians below use three baseline samples and six final samples per locale/width.
The Chinese desktop measurements regressed in this run; they are not excluded
as outliers. The dependency upgrade and startup changes are combined here, so
this comparison does not isolate the cause of that regression.

| Locale / width | Before visible | After visible | After ready callback |
| --- | ---: | ---: | ---: |
| zh / 1440 | 5.74 s | 6.82 s | 6.67 s |
| zh / 390 | 5.77 s | 5.97 s | 5.84 s |
| en / 1440 | 5.69 s | 5.74 s | 5.61 s |
| en / 390 | 5.50 s | 5.61 s | 5.48 s |

The [sample summary](./playground-startup-2026-10-22.json) includes FCP, payloads,
page errors, and final phase marks for auditing these numbers.

Further substantial improvement requires reducing the VS Code services and
extension module graph, or using a smaller editor integration. That needs
separate compatibility work for TextMate themes, diagnostics, formatting,
localized menus, model synchronization, and the extension host. Fetching the
Chinese runtime chunks earlier without evaluating them is another candidate,
but requires a supported bundler preload boundary and its own measurement.

## Dependency and build compatibility

Direct npm dependencies were refreshed to the current stable registry versions,
including Next 16.4, React 19.3, Lingui 6, AI SDK 7, Vitest 5/Vite 8, ESLint 10,
and pnpm 12. Monaco/VS Code 38.0.3 was already current. Modal CLI and FastAPI were
also updated; the Cangjie compiler lock and container OS contract were retained.

TypeScript 7 supplies the compiler through the `@typescript/native` alias.
Tools that import the JavaScript compiler API use the official
`@typescript/typescript6` compatibility package under the `typescript` name.
The assistant-ui tool-input preservation patch moved to `@assistant-ui/ai-sdk`,
where the affected conversion code now resides.

Next 16.4 rejects namespace imports from global CSS. The narrowly scoped Monaco
loader preserves CSS side-effect imports and asset handling while providing an
empty object to its optional Shadow DOM registration hook. The app uses ordinary
document roots; enabling Shadow DOM would require revisiting this adaptation.

`pnpm lingui:compile` only compiles catalogs. Font generation is its own
`pnpm fonts:generate` task, explicitly called after catalog compilation by
`predev` and `prebuild`.

EdgeOne CLI 1.6.44 bundles adapter 0.2.10-beta.11, whose middleware runtime
assumes flat Turbopack factory groups. Next 16.4 also emits a nested strict
group. The adapter incorrectly registers that array as a module ID and fails
at runtime despite a successful build. The deployment workflow patches only
the adapter's factory installer to support this format and preserve factory
aliases, matching Next's runtime behavior. Turbopack remains enabled.

The patch checks both the adapter version and the original function hash and
stops on an unknown implementation. Six regression tests cover the installer;
eight checks execute the compiled application middleware. After deployment,
HTTP checks verify both locales, isolation headers, language redirects, and
the API origin guard. Remove the patch after an upstream adapter release
supports these cases and passes the same checks.
