import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

const srcRoot = fileURLToPath(new URL('./src', import.meta.url))
const sharedResolve = {
  alias: {
    '@': srcRoot,
  },
}

const reactPlugin = react({
  babel: {
    plugins: ['@lingui/babel-plugin-lingui-macro'],
  },
})

export default defineConfig({
  plugins: [reactPlugin],
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
        'src/modules/i18n/**',
        'scripts/download-lsp-cli.mjs',
        'scripts/download-lsp.mjs',
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
        plugins: [reactPlugin],
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
        plugins: [reactPlugin],
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
        plugins: [reactPlugin],
        resolve: sharedResolve,
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.{ts,tsx}'],
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
        },
      },
    ],
  },
  resolve: sharedResolve,
})
