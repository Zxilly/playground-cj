import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MonacoEditorReactComp } from './EditorWrapper'

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

const monacoInit = vi.hoisted(() => ({
  promise: Promise.resolve(),
  resolve: (() => {}) as () => void,
  initialised: false,
}))
const editorAppStart = vi.hoisted(() => vi.fn())
const editorAppDispose = vi.hoisted(() => vi.fn())
const vscodeWrapperStart = vi.hoisted(() => vi.fn())
const vscodeWrapperInitExtensions = vi.hoisted(() => vi.fn())
const vscodeWrapperDispose = vi.hoisted(() => vi.fn())
const ensureCangjieMonarchTokensProvider = vi.hoisted(() => vi.fn())

vi.mock('monaco-languageclient/vscodeApiWrapper', () => ({
  defaultViewsHtml: '<div id="workbench-container"></div>',
  getEnhancedMonacoEnvironment: () => ({
    vscodeApiGlobalInitAwait: monacoInit.promise,
    vscodeApiInitialised: monacoInit.initialised,
  }),
  MonacoVscodeApiWrapper: class {
    start = vscodeWrapperStart
    initExtensions = vscodeWrapperInitExtensions
    dispose = vscodeWrapperDispose
  },
}))

vi.mock('monaco-languageclient/editorApp', () => ({
  EditorApp: class {
    start = editorAppStart
    dispose = editorAppDispose
    getEditor = () => ({ layout: vi.fn() })
  },
}))

vi.mock('@codingame/monaco-vscode-editor-api', () => ({
  Uri: { parse: vi.fn(value => ({ toString: () => value })) },
  editor: {
    create: vi.fn(),
    createModel: vi.fn(),
    getModel: vi.fn(),
    setModelLanguage: vi.fn(),
    setModelMarkers: vi.fn(),
  },
  MarkerSeverity: {
    Hint: 1,
    Info: 2,
    Warning: 4,
    Error: 8,
  },
}))

vi.mock('@/lib/monaco', () => ({
  createEditorAppConfig: vi.fn((code?: string) => ({
    codeResources: {
      modified: {
        text: code ?? '',
        uri: 'file:///playground/src/main.cj',
        enforceLanguageId: 'cangjie',
      },
    },
    editorOptions: { language: 'cangjie' },
  })),
  createLanguageClient: vi.fn(),
  createMonacoVscodeApiConfig: vi.fn(() => ({})),
  ensureCangjieMonarchTokensProvider,
  isLanguageClientAvailable: vi.fn(() => false),
}))

vi.mock('@/lib/lsp', () => ({
  getCurrentEditorPort: vi.fn(),
  startLsp: vi.fn(),
  subscribeLspStatus: vi.fn(),
}))

vi.mock('@/lib/lsp-commands', () => ({
  registerLspCommands: vi.fn(),
}))

vi.mock('@/lib/statusbar', () => ({
  createCustomStatusBar: vi.fn(),
}))

vi.mock('@/modules/cangjie-editor/components/LspStatusIndicator', () => ({
  LspStatusIndicator: () => null,
}))

describe('monacoEditorReactComp', () => {
  beforeEach(() => {
    const gate = deferred<void>()
    monacoInit.promise = gate.promise
    monacoInit.resolve = gate.resolve
    monacoInit.initialised = false
    editorAppStart.mockReset().mockResolvedValue(undefined)
    editorAppDispose.mockReset().mockResolvedValue(undefined)
    vscodeWrapperStart.mockReset().mockResolvedValue(undefined)
    vscodeWrapperInitExtensions.mockReset().mockResolvedValue(undefined)
    vscodeWrapperDispose.mockReset().mockResolvedValue(undefined)
    ensureCangjieMonarchTokensProvider.mockReset()
    vi.stubGlobal('ResizeObserver', class {
      observe = vi.fn()
      disconnect = vi.fn()
    })
  })

  it('does not start EditorApp after the host unmounts during async Monaco init', async () => {
    const view = render(<MonacoEditorReactComp code="main() {}" locale="zh" />)

    view.unmount()

    await act(async () => {
      monacoInit.resolve()
      await monacoInit.promise
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(editorAppStart).not.toHaveBeenCalled()
  })

  it('re-registers extension contributions after the global Monaco API is already initialized', async () => {
    monacoInit.initialised = true
    render(<MonacoEditorReactComp code="main() {}" locale="zh" />)

    await act(async () => {
      monacoInit.resolve()
      await monacoInit.promise
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(vscodeWrapperStart).toHaveBeenCalled()
    expect(ensureCangjieMonarchTokensProvider).toHaveBeenCalled()
    expect(vscodeWrapperInitExtensions).toHaveBeenCalled()
    expect(editorAppStart).toHaveBeenCalled()
    expect(vscodeWrapperInitExtensions.mock.invocationCallOrder[0]).toBeLessThan(editorAppStart.mock.invocationCallOrder[0])
  })

  it('does not duplicate extension file registration during the first Monaco initialization', async () => {
    render(<MonacoEditorReactComp code="main() {}" locale="zh" />)

    await act(async () => {
      monacoInit.resolve()
      await monacoInit.promise
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(vscodeWrapperStart).toHaveBeenCalled()
    expect(vscodeWrapperInitExtensions).not.toHaveBeenCalled()
    expect(editorAppStart).toHaveBeenCalled()
  })
})
