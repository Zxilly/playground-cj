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
    'react/dom-no-dangerously-set-innerhtml': 'off',
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
    'public/lsp/*.*',
    '**/*.json',
    '**/*.mjs',
  ],
}, pluginLingui.configs['flat/recommended'], {
  files: ['pnpm-workspace.yaml'],
  rules: {
    // Keep dependency policy independent of a lint preset upgrade.
    'pnpm/yaml-enforce-settings': ['error', {
      settings: { minimumReleaseAgeExcludePrune: true, shellEmulator: true },
    }],
  },
})
