import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  registerDocumentSemanticTokensProvider: vi.fn(),
  setMonarchTokensProvider: vi.fn(),
  enabled: false,
}))

vi.mock('@codingame/monaco-vscode-editor-api', () => ({
  languages: {
    getLanguages: () => [{ id: 'cangjie' }],
    register: mocks.register,
    registerDocumentSemanticTokensProvider: mocks.registerDocumentSemanticTokensProvider,
    setMonarchTokensProvider: mocks.setMonarchTokensProvider,
  },
}))

vi.mock('@/lib/hmr-store', () => ({
  HMR_SLOT_KEYS: { MONACO_CANGJIE_MONARCH_PROVIDER: 'monarch' },
  hmrFlag: () => ({
    get: () => mocks.enabled,
    set: (value: boolean) => {
      mocks.enabled = value
    },
  }),
}))

describe('cangjie syntax services', () => {
  beforeEach(() => {
    mocks.enabled = false
    mocks.register.mockClear()
    mocks.registerDocumentSemanticTokensProvider.mockClear()
    mocks.setMonarchTokensProvider.mockClear()
  })

  it('keeps the extension TextMate grammar instead of overriding it with Monarch', async () => {
    const { ensureCangjieMonarchTokensProvider } = await import('./cangjie-monarch')
    ensureCangjieMonarchTokensProvider()

    expect(mocks.registerDocumentSemanticTokensProvider).toHaveBeenCalledWith(
      'cangjie',
      expect.any(Object),
    )
    expect(mocks.setMonarchTokensProvider).not.toHaveBeenCalled()
  })
})
