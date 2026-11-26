import { afterEach, describe, expect, it, vi } from 'vitest'
import { CANGJIE_LANGUAGE_ID, CANGJIE_LANGUAGE_NAME } from './language'
import { createEditorAppConfig, createMonacoVscodeApiConfig } from './config'
import { DARK_COLOR_THEME, LIGHT_COLOR_THEME } from './theme-sync'

vi.mock('@/const', () => ({
  examples: [['hello-world', { zh: { content: 'main() {}' }, en: { content: 'main() {}' } }]],
}))

vi.mock('@/app/font', () => ({
  fontFamily: 'monospace',
}))

vi.mock('./workers', () => ({
  configureMonacoWorkers: vi.fn(),
}))

afterEach(() => {
  document.documentElement.classList.remove('dark')
})

describe('monaco Cangjie language configuration', () => {
  it('creates editor models using the same lowercase language id as Shiki and enables fixedOverflowWidgets', () => {
    const config = createEditorAppConfig('main() {}')

    expect(config.editorOptions?.language).toBe(CANGJIE_LANGUAGE_ID)
    expect(config.editorOptions?.fixedOverflowWidgets).toBe(true)
    expect('overrideAutomaticLayout' in config).toBe(false)
    expect(config.codeResources?.modified?.enforceLanguageId).toBe(CANGJIE_LANGUAGE_ID)
    expect(config.codeResources?.modified?.uri).toBe('file:///playground/src/main.cj')
  })

  it('supports compact embedded editor presentation options', () => {
    const config = createEditorAppConfig('main() {}', 'zh', 'card-1', { compact: true })

    expect(config.editorOptions).toMatchObject({
      fixedOverflowWidgets: true,
      wordWrap: 'on',
      scrollBeyondLastLine: false,
      mouseWheelZoom: false,
      scrollbar: { alwaysConsumeMouseWheel: false },
    })
  })

  it('enables async tokenization and syncs workbench color theme from html.dark instead of OS auto-detect', () => {
    document.documentElement.classList.remove('dark')
    const lightConfig = createMonacoVscodeApiConfig()
    const lightUserConfig = JSON.parse(lightConfig.userConfiguration?.json ?? '{}')
    expect(lightUserConfig['editor.experimental.asyncTokenization']).toBe(true)
    expect(lightUserConfig['window.autoDetectColorScheme']).toBe(false)
    expect(lightUserConfig['workbench.colorTheme']).toBe(LIGHT_COLOR_THEME)

    document.documentElement.classList.add('dark')
    const darkConfig = createMonacoVscodeApiConfig()
    const darkUserConfig = JSON.parse(darkConfig.userConfiguration?.json ?? '{}')
    expect(darkUserConfig['workbench.colorTheme']).toBe(DARK_COLOR_THEME)
  })

  it('registers the Cangjie TextMate grammar against the lowercase language id', () => {
    const config = createMonacoVscodeApiConfig()
    const extension = config.extensions?.[0]
    const contributes = extension?.config.contributes

    expect(extension?.config).toMatchObject({
      name: 'cangjie',
      displayName: 'Cangjie Extension',
      publisher: 'zxilly',
    })
    expect(contributes?.languages?.[0]).toMatchObject({
      id: CANGJIE_LANGUAGE_ID,
      aliases: [CANGJIE_LANGUAGE_NAME, CANGJIE_LANGUAGE_ID],
    })
    expect(contributes?.grammars?.[0]).toMatchObject({
      language: CANGJIE_LANGUAGE_ID,
      scopeName: 'source.cj',
    })
    expect(extension?.config.browser).toBeUndefined()
    expect(extension?.filesOrContents?.has('./extension.js')).toBe(false)
    expect(extension?.filesOrContents?.has('./cangjie-grammar.json')).toBe(true)
  })
})
