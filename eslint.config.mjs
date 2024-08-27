import antfu from '@antfu/eslint-config'

export default antfu({
  react: true,
  rules: {
    'react-dom/no-dangerously-set-innerhtml': 'off',
  },
}, {
  ignores: [
    'tailwind.config.ts',
    '**/*.json',
    'src/components/ui/*.*',
  ],
})
