import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { retainModelScope } from '@/lib/monaco/model-lifecycle'
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
const vscodeWrapperStart = vi.hoisted(() => vi.fn())
const vscodeWrapperInitExtensions = vi.hoisted(() => vi.fn())
const vscodeWrapperDispose = vi.hoisted(() => vi.fn())
const ensureCangjieMonarchTokensProvider = vi.hoisted(() => vi.fn())
const configureMonacoWorkers = vi.hoisted(() => vi.fn())
const acquireLanguageService = vi.hoisted(() => vi.fn())
const isLanguageClientAvailable = vi.hoisted(() => vi.fn())
const monacoEditorCreate = vi.hoisted(() => vi.fn())
const monacoEditorCreateModel = vi.hoisted(() => vi.fn())
const monacoEditorGetModel = vi.hoisted(() => vi.fn())
const modelFileMirrorUpdate = vi.hoisted(() => vi.fn())
const modelFileMirrorDispose = vi.hoisted(() => vi.fn())

vi.mock('@/lib/monaco/vscode-api', () => ({
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

vi.mock('@/lib/monaco/model-file-mirror', () => ({
  createModelFileMirror: vi.fn(async () => ({
    update: modelFileMirrorUpdate,
    dispose: modelFileMirrorDispose,
  })),
}))

vi.mock('@codingame/monaco-vscode-editor-api', () => ({
  Uri: { parse: vi.fn(value => ({ toString: () => value })) },
  editor: {
    create: monacoEditorCreate,
    createModel: monacoEditorCreateModel,
    getModel: monacoEditorGetModel,
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
  configureMonacoWorkers,
  acquireLanguageService,
  createEditorAppConfig: vi.fn((code?: string, _locale?: string, uriHint?: string) => ({
    codeResources: {
      modified: {
        text: code ?? '',
        uri: `file:///playground/${uriHint ?? 'src'}/main.cj`,
        enforceLanguageId: 'cangjie',
      },
    },
    editorOptions: { language: 'cangjie' },
  })),
  createLanguageClient: vi.fn(),
  createMonacoVscodeApiConfig: vi.fn(() => ({})),
  ensureCangjieMonarchTokensProvider,
  isLanguageClientAvailable,
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
    vscodeWrapperStart.mockReset().mockResolvedValue(undefined)
    vscodeWrapperInitExtensions.mockReset().mockResolvedValue(undefined)
    vscodeWrapperDispose.mockReset().mockResolvedValue(undefined)
    ensureCangjieMonarchTokensProvider.mockReset()
    configureMonacoWorkers.mockReset()
    acquireLanguageService.mockReset().mockReturnValue(vi.fn(async () => {}))
    isLanguageClientAvailable.mockReset().mockReturnValue(true)
    monacoEditorGetModel.mockReset().mockReturnValue(undefined)
    monacoEditorCreateModel.mockReset().mockImplementation((_text, _language, uri) => ({
      dispose: vi.fn(),
      onDidChangeContent: vi.fn(() => ({ dispose: vi.fn() })),
      getLanguageId: vi.fn(() => 'cangjie'),
      getValue: vi.fn(() => 'main() {}'),
      isDisposed: vi.fn(() => false),
      uri,
    }))
    monacoEditorCreate.mockReset().mockReturnValue({
      dispose: vi.fn(),
      getModel: vi.fn(),
      layout: vi.fn(),
      setModel: vi.fn(),
      updateOptions: vi.fn(),
    })
    modelFileMirrorUpdate.mockReset()
    modelFileMirrorDispose.mockReset().mockResolvedValue(undefined)
    vi.stubGlobal('ResizeObserver', class {
      observe = vi.fn()
      disconnect = vi.fn()
    })
  })

  it('does not create the editor after the host unmounts during async Monaco init', async () => {
    const view = render(<MonacoEditorReactComp code="main() {}" locale="zh" />)

    view.unmount()

    await act(async () => {
      monacoInit.resolve()
      await monacoInit.promise
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(monacoEditorCreate).not.toHaveBeenCalled()
  })

  it('reuses extension contributions after the global Monaco API is already initialized', async () => {
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
    expect(vscodeWrapperInitExtensions).not.toHaveBeenCalled()
    expect(monacoEditorCreate).toHaveBeenCalled()
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
    expect(monacoEditorCreate).toHaveBeenCalled()
  })

  it('does not attempt duplicate extension-file registration on later mounts', async () => {
    monacoInit.initialised = true
    vscodeWrapperInitExtensions.mockRejectedValueOnce(
      new Error('file "extension-file://zxilly.cangjie/extension/extension.js/" already exists'),
    )

    render(<MonacoEditorReactComp code="main() {}" locale="zh" />)

    await act(async () => {
      monacoInit.resolve()
      await monacoInit.promise
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(vscodeWrapperInitExtensions).not.toHaveBeenCalled()
    expect(ensureCangjieMonarchTokensProvider).toHaveBeenCalled()
    expect(monacoEditorCreate).toHaveBeenCalled()
  })

  it('continues editor startup when Monaco services were already initialized by another editor', async () => {
    monacoInit.initialised = true
    vscodeWrapperStart.mockRejectedValueOnce(new Error('Services are already initialized'))

    render(<MonacoEditorReactComp code="main() {}" locale="zh" />)

    await act(async () => {
      monacoInit.resolve()
      await monacoInit.promise
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(vscodeWrapperStart).toHaveBeenCalled()
    expect(ensureCangjieMonarchTokensProvider).toHaveBeenCalled()
    expect(monacoEditorCreate).toHaveBeenCalled()
    expect(vscodeWrapperDispose).not.toHaveBeenCalled()
  })

  it('does not re-register or dispose the page runtime when one of two editors unmounts', async () => {
    monacoInit.initialised = true
    const view = render(
      <>
        <MonacoEditorReactComp code="first" uriHint="first" />
        <MonacoEditorReactComp code="second" uriHint="second" />
      </>,
    )

    await act(async () => {
      monacoInit.resolve()
      await monacoInit.promise
      await Promise.resolve()
      await Promise.resolve()
    })
    view.rerender(<MonacoEditorReactComp code="second" uriHint="second" />)
    await act(async () => {
      await Promise.resolve()
    })

    expect(vscodeWrapperInitExtensions).not.toHaveBeenCalled()
    expect(vscodeWrapperDispose).not.toHaveBeenCalled()
  })

  it('starts an editor without acquiring LSP when the language client is unavailable', async () => {
    isLanguageClientAvailable.mockReturnValue(false)
    const onLoad = vi.fn()

    render(<MonacoEditorReactComp code="main() {}" locale="zh" onLoad={onLoad} />)

    await act(async () => {
      monacoInit.resolve()
      await monacoInit.promise
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(ensureCangjieMonarchTokensProvider).toHaveBeenCalled()
    expect(monacoEditorCreate).toHaveBeenCalled()
    expect(onLoad).toHaveBeenCalled()
    expect(vscodeWrapperStart).toHaveBeenCalled()
    expect(acquireLanguageService).not.toHaveBeenCalled()
  })

  it('gives unhinted editor instances distinct model URIs', async () => {
    isLanguageClientAvailable.mockReturnValue(false)
    render(
      <>
        <MonacoEditorReactComp code="first" />
        <MonacoEditorReactComp code="second" />
      </>,
    )
    await act(async () => {
      monacoInit.resolve()
      await monacoInit.promise
      await Promise.resolve()
      await Promise.resolve()
    })

    const uris = monacoEditorCreateModel.mock.calls.map(call => call[2].toString())
    expect(uris).toHaveLength(2)
    expect(new Set(uris).size).toBe(2)
  })

  it('disposes an ordinary model when its editor unmounts', async () => {
    isLanguageClientAvailable.mockReturnValue(false)
    const view = render(<MonacoEditorReactComp code="main() {}" uriHint="dispose-now" />)
    await act(async () => {
      monacoInit.resolve()
      await monacoInit.promise
      await Promise.resolve()
      await Promise.resolve()
    })
    const model = monacoEditorCreateModel.mock.results.at(-1)!.value

    view.unmount()
    await act(async () => {
      await Promise.resolve()
    })
    expect(model.dispose).toHaveBeenCalledOnce()
  })

  it('retains a scoped draft across editor unmount and disposes it when the scope ends', async () => {
    isLanguageClientAvailable.mockReturnValue(false)
    const releaseScope = retainModelScope('lesson:test')
    const view = render(
      <MonacoEditorReactComp
        code="main() {}"
        uriHint="scoped-draft"
        modelScope="lesson:test"
        retainModelOnUnmount
      />,
    )
    await act(async () => {
      monacoInit.resolve()
      await monacoInit.promise
      await Promise.resolve()
      await Promise.resolve()
    })
    const model = monacoEditorCreateModel.mock.results.at(-1)!.value

    view.unmount()
    await act(async () => {
      await Promise.resolve()
    })
    expect(model.dispose).not.toHaveBeenCalled()

    releaseScope()
    expect(model.dispose).toHaveBeenCalledOnce()
  })
})
