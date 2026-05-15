import { describe, expect, it, vi } from 'vitest'
import { CANGJIE_LANGUAGE_ID, CANGJIE_LANGUAGE_NAME } from './language'
import { createEditorAppConfig, createMonacoVscodeApiConfig } from './config'

vi.mock('@/const', () => ({
  examples: [['hello-world', { zh: { content: 'main() {}' }, en: { content: 'main() {}' } }]],
}))

vi.mock('@/app/font', () => ({
  fontFamily: 'monospace',
}))

vi.mock('@/lib/statusbar', () => ({
  getStatusBarServiceOverrides: vi.fn(() => ({})),
}))

vi.mock('./workers', () => ({
  configureMonacoWorkers: vi.fn(),
}))

vi.mock('./views', () => ({
  initializeMonacoViewsService: vi.fn(),
}))

describe('monaco Cangjie language configuration', () => {
  it('creates editor models using the same lowercase language id as Shiki', () => {
    const config = createEditorAppConfig('main() {}')

    expect(config.editorOptions?.language).toBe(CANGJIE_LANGUAGE_ID)
    expect(config.codeResources?.modified?.enforceLanguageId).toBe(CANGJIE_LANGUAGE_ID)
  })

  it('registers the Cangjie TextMate grammar against the lowercase language id', () => {
    const config = createMonacoVscodeApiConfig()
    const extension = config.extensions?.[0]
    const contributes = extension?.config.contributes

    expect(extension?.config).toMatchObject({
      name: 'cangjie',
      displayName: 'Cangjie Extension',
      publisher: 'zxilly',
      browser: './extension.js',
    })
    expect(contributes?.languages?.[0]).toMatchObject({
      id: CANGJIE_LANGUAGE_ID,
      aliases: [CANGJIE_LANGUAGE_NAME, CANGJIE_LANGUAGE_ID],
    })
    expect(contributes?.grammars?.[0]).toMatchObject({
      language: CANGJIE_LANGUAGE_ID,
      scopeName: 'source.cj',
    })
    expect(extension?.filesOrContents?.has('./extension.js')).toBe(true)
    expect(extension?.filesOrContents?.has('./cangjie-grammar.json')).toBe(true)
  })
})
