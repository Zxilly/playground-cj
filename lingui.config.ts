import type { LinguiConfig } from '@lingui/conf'

const config: LinguiConfig = {
  locales: ['zh', 'en'],
  sourceLocale: 'zh',
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}/messages',
      include: ['src'],
      exclude: ['**/node_modules/**'],
    },
  ],
  format: 'po',
  compileNamespace: 'es',
  runtimeConfigModule: {
    i18n: ['@/lib/i18n', 'i18n'],
    Trans: ['@lingui/react', 'Trans'],
  },
}

export default config
