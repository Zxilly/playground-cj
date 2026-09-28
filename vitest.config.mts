import { fileURLToPath } from 'node:url'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import type { Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

const srcRoot = fileURLToPath(new URL('./src', import.meta.url))
const cjoRoot = new URL('./public/lsp/modules/linux_x86_64_cjnative/', import.meta.url)
const browserEnv = {
  NODE_ENV: 'test',
  WASM_ASSETS_VERSION: 'browser-test',
  CJO_TARGET: 'linux_x86_64_cjnative',
  CJO_MODULES: JSON.stringify((existsSync(cjoRoot) ? readdirSync(cjoRoot, { recursive: true }) : [])
    .map(String).filter(path => path.endsWith('.cjo')).map(path => path.replaceAll('\\', '/'))),
}
// Serve Emscripten glue unchanged, as Next does. Vite otherwise rewrites the
// dynamic import with ?import and rejects imports from public/.
const lspGluePlugin: Plugin = {
  name: 'wasm-glue-static-module',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const path = req.url?.split('?')[0]
      if (path !== '/lsp/LSPServer-wasm.js' && path !== '/lsp/cjfmt-wasm.mjs')
        return next()
      res.setHeader('Content-Type', 'text/javascript')
      res.end(readFileSync(new URL(`./public${path}`, import.meta.url)))
    })
  },
}
const sharedResolve = {
  alias: {
    '@': srcRoot,
  },
  dedupe: ['@codingame/monaco-vscode-api'],
}

const monacoVscodePackages = [
  '@codingame/monaco-vscode-api',
  '@codingame/monaco-vscode-base-service-override',
  '@codingame/monaco-vscode-configuration-service-override',
  '@codingame/monaco-vscode-editor-api',
  '@codingame/monaco-vscode-editor-service-override',
  '@codingame/monaco-vscode-extension-api',
  '@codingame/monaco-vscode-extensions-service-override',
  '@codingame/monaco-vscode-languages-service-override',
  '@codingame/monaco-vscode-log-service-override',
  '@codingame/monaco-vscode-model-service-override',
  '@codingame/monaco-vscode-textmate-service-override',
  '@codingame/monaco-vscode-theme-defaults-default-extension',
  '@codingame/monaco-vscode-theme-service-override',
  '@codingame/monaco-vscode-view-status-bar-service-override',
  '@codingame/monaco-vscode-views-service-override',
]

const reactPlugin = react({
  babel: {
    plugins: ['@lingui/babel-plugin-lingui-macro'],
  },
})

const cangjieRawPlugin = {
  name: 'cangjie-raw-source',
  enforce: 'pre' as const,
  load(id: string) {
    const path = id.split('?', 1)[0]
    if (!path.endsWith('.cj'))
      return null
    return `export default ${JSON.stringify(readFileSync(path, 'utf8'))}`
  },
}

export default defineConfig({
  plugins: [reactPlugin, cangjieRawPlugin],
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      include: [
        'src/features/**/*.{ts,tsx}',
        'src/lib/**/*.{ts,tsx}',
        'src/modules/**/*.{ts,tsx}',
        'src/service/**/*.{ts,tsx}',
        'scripts/**/*.mjs',
      ],
      exclude: [
        '**/*.test.{ts,tsx,mts}',
        '**/*.browser.test.{ts,tsx}',
        '**/*.e2e.test.ts',
        '**/*.d.ts',
        'src/components/ui/**',
        'src/lib/**/*.worker.js',
        'src/lib/ai/concept-graph/concept-graph.json',
        'src/lib/lsp.ts',
        'src/lib/lsp-commands.ts',
        'src/lib/mcp/client.ts',
        'src/lib/monaco/**',
        'src/lib/redis.ts',
        'src/lib/statusbar.ts',
        'src/features/playground/components/ExamplesDropdown.tsx',
        'src/features/playground/components/LanguageSelector.tsx',
        'src/features/playground/components/Playground.tsx',
        'src/features/playground/components/PlaygroundWrapper.tsx',
        'src/features/playground/components/ShareButton.tsx',
        'src/features/tour/components/TourApp.tsx',
        'src/features/tour/components/TourLayout.tsx',
        'src/features/tour/components/TourEditor.tsx',
        'src/features/tour/components/TourWrapper.tsx',
        'src/features/tour/components/mdx/CompareGroup.tsx',
        'src/features/tour/components/mdx/CompareWith.tsx',
        'src/features/tour/components/mdx/LanguagePicker.tsx',
        'src/features/tour/components/mdx/Note.tsx',
        'src/features/tour/components/mdx/index.ts',
        'src/modules/assistant-ui/chat/**',
        'src/modules/assistant-ui/registry/**',
        'src/modules/analytics/**',
        'src/modules/cangjie-editor/components/CodeRunner.tsx',
        'src/modules/cangjie-editor/components/EditorWrapper.tsx',
        'src/modules/cangjie-editor/components/LspStatusIndicator.tsx',
        // Monaco does not render under jsdom; owning surfaces are unit-tested
        // with an injected textarea editor instead.
        'src/features/teach/components/editor/CangjieMonacoEditor.tsx',
        'src/modules/i18n/**',
        'scripts/download-wasm-assets-cli.mjs',
        'scripts/download-wasm-assets.mjs',
      ],
      thresholds: {
        branches: 70,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    projects: [
      {
        // Unit project needs the lingui macro plugin because some pure .ts
        // utility modules (e.g. src/service/run.ts) call the `t\`...\``
        // template macro directly — without the transform, `t` resolves to
        // undefined and the module throws at runtime.
        plugins: [reactPlugin, cangjieRawPlugin],
        resolve: sharedResolve,
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: [
            'src/**/*.test.ts',
            'tests/**/*.test.{ts,mts}',
          ],
          exclude: [
            'src/**/*.browser.test.ts',
            'src/**/*.e2e.test.ts',
            'tests/**/*.e2e.test.ts',
          ],
        },
      },
      {
        plugins: [reactPlugin, cangjieRawPlugin],
        resolve: sharedResolve,
        test: {
          name: 'component',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
          exclude: [
            'src/**/*.browser.test.tsx',
            'src/**/*.e2e.test.tsx',
          ],
        },
      },
      {
        plugins: [reactPlugin, cangjieRawPlugin, lspGluePlugin],
        define: {
          'process.env': JSON.stringify(browserEnv),
        },
        server: {
          headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
          },
        },
        optimizeDeps: {
          exclude: monacoVscodePackages,
          include: ['@lingui/react'],
        },
        resolve: sharedResolve,
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.{ts,tsx}'],
          fileParallelism: false,
          testTimeout: 30_000,
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [
              { browser: 'chromium' },
            ],
          },
        },
      },
      {
        resolve: sharedResolve,
        test: {
          name: 'e2e',
          environment: 'node',
          include: ['tests/**/*.e2e.test.ts'],
          sequence: {
            concurrent: false,
          },
          // Each e2e file starts its own Next dev server, and Next 16 holds a
          // per-directory dev lock (`.next/dev/lock`). Running e2e files in
          // parallel workers makes them race for that lock — the loser exits with
          // "Another next dev server is already running". Serialize the files so
          // only one dev server is live at a time.
          fileParallelism: false,
        },
      },
    ],
  },
  resolve: sharedResolve,
})
