import { act, cleanup, render } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { retainModelScope } from '@/lib/monaco/model-lifecycle'
import { createEditorAppConfig } from '@/lib/monaco'
import { createCustomStatusBar } from '@/lib/statusbar'
import type { StatusBarHandle } from '@/lib/statusbar'
import { subscribeLspStatus } from '@/lib/lsp'
import { MonacoEditorReactComp } from './EditorWrapper'

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function createStatusBarHandle(parent: HTMLElement) {
  const container = document.createElement('footer')
  Object.defineProperty(container, 'offsetHeight', { value: 22 })
  parent.appendChild(container)
  return { container, dispose: vi.fn(() => container.remove()) }
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
  LspStatusIndicator: () => <span data-testid="lsp-status-indicator" />,
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

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
    vi.mocked(createCustomStatusBar).mockReset().mockImplementation(async parent => createStatusBarHandle(parent))
    vi.mocked(subscribeLspStatus).mockReset().mockReturnValue(vi.fn())
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

  it('makes the editor usable while the status bar is still loading', async () => {
    const gate = deferred<StatusBarHandle>()
    vi.mocked(createCustomStatusBar).mockReturnValueOnce(gate.promise)
    const onLoad = vi.fn()
    const view = render(<MonacoEditorReactComp code="main() {}" statusBarCompactHeight={22} onLoad={onLoad} />)
    await act(async () => {
      monacoInit.resolve()
      await monacoInit.promise
    })
    expect(monacoEditorCreate).toHaveBeenCalled()
    expect(createCustomStatusBar).toHaveBeenCalledWith(expect.any(HTMLElement), {
      position: 'bottom',
      height: 22,
      compactHeight: 22,
    })
    expect(onLoad).toHaveBeenCalledOnce()
    const dispose = vi.fn()
    view.unmount()
    await act(async () => gate.resolve({
      container: document.createElement('div'),
      dispose,
    }))
    expect(dispose).toHaveBeenCalledOnce()
  })

  it.each(['default', 'unresolved'] as const)('reserves and observes the status bar height with a %s host', async (host) => {
    const observe = vi.fn()
    vi.stubGlobal('ResizeObserver', class {
      observe = observe
      disconnect = vi.fn()
    })
    const view = render(
      <MonacoEditorReactComp
        code="main() {}"
        statusBarHostRef={host === 'unresolved' ? createRef<HTMLDivElement>() : undefined}
      />,
    )
    const editorContainer = view.container.firstElementChild!
    vi.spyOn(editorContainer, 'getBoundingClientRect').mockReturnValue({ width: 640, height: 320 } as DOMRect)

    await act(async () => {
      monacoInit.resolve()
      await monacoInit.promise
    })

    const editor = monacoEditorCreate.mock.results.at(-1)!.value
    const statusBar = await vi.mocked(createCustomStatusBar).mock.results.at(-1)!.value
    expect(createCustomStatusBar).toHaveBeenCalledWith(editorContainer, {
      position: 'bottom',
      height: 22,
      compactHeight: 44,
    })
    expect(editor.layout).toHaveBeenLastCalledWith({ width: 640, height: 298 }, true)
    expect(observe.mock.calls).toEqual([[editorContainer], [statusBar.container]])
  })

  it('mounts the native status control externally without subtracting or observing its height', async () => {
    const statusBarHostRef = createRef<HTMLDivElement>()
    const nextStatusBarHostRef = createRef<HTMLDivElement>()
    const observe = vi.fn()
    const disconnect = vi.fn()
    vi.stubGlobal('ResizeObserver', class {
      observe = observe
      disconnect = disconnect
    })
    const surface = (hostRef = statusBarHostRef) => (
      <>
        <MonacoEditorReactComp code="main() {}" statusBarHostRef={hostRef} statusBarCompactHeight={22} />
        <div ref={statusBarHostRef} />
        <div ref={nextStatusBarHostRef} />
      </>
    )
    const view = render(surface())
    const editorContainer = view.container.firstElementChild!
    const externalHost = statusBarHostRef.current!
    vi.spyOn(editorContainer, 'getBoundingClientRect').mockReturnValue({ width: 640, height: 320 } as DOMRect)

    await act(async () => {
      monacoInit.resolve()
      await monacoInit.promise
    })

    const editor = monacoEditorCreate.mock.results.at(-1)!.value
    const statusBar = await vi.mocked(createCustomStatusBar).mock.results.at(-1)!.value
    expect(createCustomStatusBar).toHaveBeenCalledWith(externalHost, {
      position: 'bottom',
      height: 22,
      compactHeight: 22,
    })
    expect(externalHost.contains(view.getByTestId('lsp-status-indicator'))).toBe(true)
    expect(editor.layout).toHaveBeenLastCalledWith({ width: 640, height: 320 }, true)
    expect(observe.mock.calls).toEqual([[editorContainer]])
    expect(acquireLanguageService).toHaveBeenCalledOnce()

    view.rerender(surface(nextStatusBarHostRef))
    expect(monacoEditorCreate).toHaveBeenCalledOnce()
    expect(createCustomStatusBar).toHaveBeenCalledOnce()
    expect(statusBar.container.parentElement).toBe(externalHost)

    const releaseLanguageService = acquireLanguageService.mock.results.at(-1)!.value
    const unsubscribeLspStatus = vi.mocked(subscribeLspStatus).mock.results.at(-1)!.value
    view.unmount()
    await act(async () => {})
    expect(statusBar.dispose).toHaveBeenCalledOnce()
    expect(externalHost.childElementCount).toBe(0)
    expect(editor.dispose).toHaveBeenCalledOnce()
    expect(unsubscribeLspStatus).toHaveBeenCalledOnce()
    expect(releaseLanguageService).toHaveBeenCalledOnce()
    expect(disconnect).toHaveBeenCalledOnce()
  })

  it('disposes a pending external status bar after unmount without restoring its portal', async () => {
    const statusBarHostRef = createRef<HTMLDivElement>()
    const gate = deferred<StatusBarHandle>()
    vi.mocked(createCustomStatusBar).mockReturnValueOnce(gate.promise)
    const view = render(
      <>
        <MonacoEditorReactComp code="main() {}" statusBarHostRef={statusBarHostRef} />
        <div ref={statusBarHostRef} />
      </>,
    )
    const externalHost = statusBarHostRef.current!
    await act(async () => {
      monacoInit.resolve()
      await monacoInit.promise
    })

    expect(createCustomStatusBar).toHaveBeenCalledWith(externalHost, expect.any(Object))
    const releaseLanguageService = acquireLanguageService.mock.results.at(-1)!.value
    view.unmount()
    const statusBar = createStatusBarHandle(externalHost)
    await act(async () => gate.resolve(statusBar))

    expect(statusBar.dispose).toHaveBeenCalledOnce()
    expect(statusBar.container.childElementCount).toBe(0)
    expect(externalHost.childElementCount).toBe(0)
    expect(releaseLanguageService).toHaveBeenCalledOnce()
  })

  it('coalesces resize notifications and skips layouts when dimensions are unchanged', async () => {
    isLanguageClientAvailable.mockReturnValue(false)
    let notifyResize!: () => void
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { notifyResize = callback }
      observe = vi.fn()
      disconnect = vi.fn()
    })
    let nextFrame = 0
    const frames = new Map<number, FrameRequestCallback>()
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback)
      return nextFrame
    }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn((frame: number) => frames.delete(frame)))
    const flushFrames = () => {
      const callbacks = [...frames.values()]
      frames.clear()
      callbacks.forEach(callback => callback(0))
    }
    const view = render(<MonacoEditorReactComp code="main() {}" />)
    let width = 640
    vi.spyOn(view.container.firstElementChild!, 'getBoundingClientRect').mockImplementation(() => ({ width, height: 320 } as DOMRect))
    await act(async () => {
      monacoInit.resolve()
      await monacoInit.promise
    })
    const editor = monacoEditorCreate.mock.results.at(-1)!.value
    expect(editor.layout).toHaveBeenCalledOnce()
    expect(editor.layout).toHaveBeenLastCalledWith({ width: 640, height: 320 }, true)

    notifyResize()
    flushFrames()
    expect(editor.layout).toHaveBeenCalledOnce()

    width = 720
    notifyResize()
    notifyResize()
    notifyResize()
    expect(frames.size).toBe(1)
    expect(editor.layout).toHaveBeenCalledOnce()
    flushFrames()
    expect(editor.layout).toHaveBeenCalledTimes(2)
    expect(editor.layout).toHaveBeenLastCalledWith({ width: 720, height: 320 }, true)

    notifyResize()
    view.unmount()
    expect(frames.size).toBe(0)
    expect(cancelAnimationFrame).toHaveBeenCalledOnce()
    flushFrames()
    expect(editor.layout).toHaveBeenCalledTimes(2)
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

  it('keeps an unhinted editor on the canonical project model', () => {
    render(<MonacoEditorReactComp code="main() {}" />)

    expect(createEditorAppConfig).toHaveBeenCalledWith('main() {}', undefined, undefined)
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
