import antfu from '@antfu/eslint-config'

export default antfu({
  react: true,
  rules: {
    'react-dom/no-dangerously-set-innerhtml': 'off',
    'no-template-curly-in-string': 'off',
    'prefer-promise-reject-errors': 'off',
    'node/prefer-global/process': 'off',
    'antfu/no-top-level-await': 'off',
    'perfectionist/sort-imports': 'off',
  },
}, {
  ignores: [
    'tailwind.config.ts',
    '**/*.json',
  ],
})
