# Playground rendering

The page uses server-rendered content inside an interactive client workspace.
Client Components still produce initial HTML; only the Monaco editor has SSR disabled.

| Content | Rendering and loading |
| --- | --- |
| Title, tour link, footer | Server Components, passed into the client workspace as React nodes. The tour URL uses the request host. |
| Editor loading state | Server-rendered skeleton with a screen-reader status. It remains visible until Monaco is ready; source code is displayed only in the editor. |
| Header and panel layout | SSR with CSS breakpoints. JavaScript supplies the resize interaction, not the initial responsive layout. Panel defaults use explicit percentage units. |
| Run/format/share controls and output | SSR followed by client hydration. Editor actions remain disabled until initialization finishes. |
| Example menu and example sources | Loaded when the menu opens. The editor imports only the two localized Hello World starters. |
| Language menu and share dialog | Loaded when opened; their controls remain in the initial HTML. Deferred menus focus themselves after their chunks arrive. |
| Translation catalogs | The server passes only the current locale to the provider. Client utilities do not bundle both catalogs again. |
| Monaco and VS Code services | Browser-only. Chinese localization loads before the runtime; independent service modules load concurrently. |
| LSP client and WASM | Browser-only. The protocol client is imported when the WASM server provides a live port. The existing page-wide client and service leases remain in use. |

Short-link requests start on the server but are passed down as promises. Suspense
streams the surrounding page while the editor waits for the shared source. The skeleton does not wait for that request.
URL-fragment shares are read only inside the browser editor, before creating its model.

The UI font subset is checked in. To regenerate it after changing translations or
examples, install `fonttools[woff]==4.62.1` and run `python scripts/subset-ui-font.py`.
Glyphs absent from the subset fall back to the complete HarmonyOS font.

All `@codingame/monaco-vscode-*` packages and the `vscode` alias must use the same
version. Version 38.0.3 integrates Monaco 0.57.0 and VS Code 1.142.0; this project
uses its editor API rather than installing a second, standalone `monaco-editor`.

`tests/e2e/playground-loading.e2e.test.ts` checks SSR with JavaScript disabled,
responsive layout, hostname-specific links, shared source initialization, the
deferred LSP client, formatting, and Chinese menus. Set `PLAYGROUND_TEST_URL` to
an existing `next start` server to test production chunks; otherwise it uses the
repository's Next development-server helper.

The loading tests also check layout shifts before interaction (total below 0.01)
and exercise the deferred language and share controls. The workspace uses the
dynamic viewport height so mobile browser toolbars do not obscure the footer.
Third-party tracking scripts use `lazyOnload` to avoid competing with hydration.

For repeatable measurements, start a production build and run:

```sh
node scripts/measure-playground-load.mjs http://127.0.0.1:3100 .scratch/playground-performance.json
```

The output contains three cold-cache samples per locale and viewport width, with
40 ms network latency, 10 Mbps bandwidth, and 4x CPU throttling. Compare medians
on the same machine without concurrent builds or tests. It records FCP, LCP,
CLS, editor readiness, and the encoded/decoded size of initial script tags.
CLS and LCP cover initial loading through two seconds after editor/font readiness;
these lab samples do not represent field Web Vitals. Completed page-resource
bytes exclude worker subresources and requests still in flight.
