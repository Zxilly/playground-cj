# Playground rendering

The page uses server-rendered content inside an interactive client workspace.
Client Components still produce initial HTML; only the Monaco editor has SSR disabled.

| Content | Rendering and loading |
| --- | --- |
| Title, tour link, footer | Server Components, passed into the client workspace as React nodes. The tour URL uses the request host. |
| Initial code preview | Server-rendered plain text, capped at 40 lines and 8,000 characters. It remains visible until the editor is ready. |
| Header and panel layout | SSR with CSS breakpoints. JavaScript supplies the resize interaction, not the initial responsive layout. Panel defaults use explicit percentage units. |
| Run/format/share controls and output | SSR followed by client hydration. Editor actions remain disabled until initialization finishes. |
| Example menu and example sources | Loaded when the menu opens. The editor imports only the two localized Hello World starters. |
| Monaco and VS Code services | Browser-only. Chinese localization loads before the runtime; independent service modules load concurrently. |
| LSP client and WASM | Browser-only. The protocol client is imported when the WASM server provides a live port. The existing page-wide client and service leases remain in use. |

Short-link requests start on the server but are passed down as promises. Suspense
streams the surrounding page while the preview and editor wait for the shared source.
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
