import antfu from '@antfu/eslint-config'

export default antfu({
  react: true,
}, {
  ignores: [
    'tailwind.config.ts',
    '**/*.json',
    'src/components/**/*.*',
  ],
})
