import antfu from '@antfu/eslint-config'
import pluginLingui from 'eslint-plugin-lingui'
import pluginGranularSelectors from 'eslint-plugin-granular-selectors'

export default antfu({
  react: true,
  nextjs: true,
  plugins: {
    'granular-selectors': pluginGranularSelectors,
  },
  rules: {
    'react-dom/no-dangerously-set-innerhtml': 'off',
    'no-template-curly-in-string': 'off',
    'prefer-promise-reject-errors': 'off',
    'node/prefer-global/process': 'off',
    'antfu/no-top-level-await': 'off',
    'perfectionist/sort-imports': 'off',
    'no-console': 'off',
    // Enforce atomic store selectors. Object-returning selectors (without
    // useShallow) silently re-render on every store change. We banned useShallow
    // entirely after the freeze incidents, so all selectors must be atomic.
    'granular-selectors/granular-selectors': ['error', {
      include: ['useStore', 'use.+Store'],
    }],
  },
}, {
  ignores: [
    'src/components/ui/*.*',
    // Vendored from the assistant-ui shadcn registry; treat as third-party.
    'src/components/thread.tsx',
    'src/components/tool-fallback.tsx',
    'src/components/tool-group.tsx',
    'src/components/reasoning.tsx',
    'src/components/markdown-text.tsx',
    'src/components/attachment.tsx',
    'src/components/tooltip-icon-button.tsx',
    'public/lsp/*.*',
    'tailwind.config.ts',
    '**/*.json',
    '**/*.mjs',
  ],
}, pluginLingui.configs['flat/recommended'])
