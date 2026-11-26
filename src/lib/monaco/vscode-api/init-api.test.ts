import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  initialize: vi.fn(),
  initUserConfiguration: vi.fn(),
  registerExtension: vi.fn(),
  getBuiltinExtensions: vi.fn(),
  themeExtensionLoaded: vi.fn(),
}))

vi.mock('@codingame/monaco-vscode-api', () => ({
  initialize: mocks.initialize,
}))

vi.mock('@codingame/monaco-vscode-api/extensions', () => ({
  getBuiltinExtensions: mocks.getBuiltinExtensions,
  registerExtension: mocks.registerExtension,
}))

vi.mock('@codingame/monaco-vscode-api/monaco', () => ({
  DisposableStore: class {
    add = vi.fn()
    dispose = vi.fn()
  },
  setUnexpectedErrorHandler: vi.fn(),
}))

vi.mock('@codingame/monaco-vscode-base-service-override', () => ({ default: () => ({}) }))
vi.mock('@codingame/monaco-vscode-configuration-service-override', () => ({
  default: () => ({}),
  initUserConfiguration: mocks.initUserConfiguration,
}))
vi.mock('@codingame/monaco-vscode-model-service-override', () => ({ default: () => ({}) }))
vi.mock('@codingame/monaco-vscode-languages-service-override', () => ({ default: () => ({}) }))
vi.mock('@codingame/monaco-vscode-textmate-service-override', () => ({
  default: () => ({ textMateTokenizationFeature: true }),
}))
vi.mock('@codingame/monaco-vscode-theme-service-override', () => ({
  default: () => ({ themeService: true }),
}))
vi.mock('@codingame/monaco-vscode-extensions-service-override', () => ({ default: () => ({}) }))
vi.mock('@codingame/monaco-vscode-theme-defaults-default-extension', () => {
  mocks.themeExtensionLoaded()
  return {}
})
vi.mock('@codingame/monaco-vscode-api/vscode/vs/base/common/uri', () => ({
  URI: { file: (p: string) => ({ path: p }) },
}))

describe('monacoVscodeApiWrapper', () => {
  beforeEach(() => {
    vi.resetModules()
    delete (globalThis as Record<string, unknown>).MonacoEnvironment
    mocks.initialize.mockReset().mockResolvedValue(undefined)
    mocks.initUserConfiguration.mockReset().mockResolvedValue(undefined)
    mocks.getBuiltinExtensions.mockReset().mockReturnValue([])
    mocks.themeExtensionLoaded.mockReset()
    mocks.registerExtension.mockReset().mockReturnValue({
      registerFileUrl: vi.fn(() => ({ dispose: vi.fn() })),
      whenReady: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn().mockResolvedValue(undefined),
    })
  })

  it('marks services initialized and still registers extensions when services are already initialized', async () => {
    mocks.initialize.mockRejectedValueOnce(new Error('Services are already initialized'))
    const { MonacoVscodeApiWrapper } = await import('./init-api')
    const { getEnhancedMonacoEnvironment } = await import('./environment')

    const wrapper = new MonacoVscodeApiWrapper({
      $type: 'extended',
      extensions: [{
        config: {
          name: 'cangjie',
          publisher: 'zxilly',
          version: '1.0.0',
          engines: { vscode: '*' },
        },
        filesOrContents: new Map([['./cangjie-grammar.json', '{}']]),
      }],
    })

    await wrapper.start()

    const env = getEnhancedMonacoEnvironment()
    expect(env.vscodeApiServicesInitialised).toBe(true)
    expect(env.vscodeApiExtensionsInitialised).toBe(true)
    expect(env.vscodeApiInitialised).toBe(true)
    expect(mocks.themeExtensionLoaded).toHaveBeenCalledOnce()
    expect(mocks.registerExtension).toHaveBeenCalledOnce()
  })
})
