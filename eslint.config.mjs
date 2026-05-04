import antfu from '@antfu/eslint-config'
import pluginLingui from 'eslint-plugin-lingui'

export default antfu({
  react: true,
  nextjs: true,
  rules: {
    'react-dom/no-dangerously-set-innerhtml': 'off',
    'no-template-curly-in-string': 'off',
    'prefer-promise-reject-errors': 'off',
    'node/prefer-global/process': 'off',
    'antfu/no-top-level-await': 'off',
    'perfectionist/sort-imports': 'off',
    'no-console': 'off',
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
