import antfu from '@antfu/eslint-config'
import pluginLingui from 'eslint-plugin-lingui'

export default antfu({
  react: true,
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
    'public/lsp/*.*',
    'tailwind.config.ts',
    '**/*.json',
    '**/*.mjs',
  ],
}, pluginLingui.configs['flat/recommended'])
