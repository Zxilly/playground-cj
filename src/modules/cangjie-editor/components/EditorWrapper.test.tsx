import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef, StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { retainModelScope } from '@/lib/monaco/model-lifecycle'
import { createEditorAppConfig } from '@/lib/monaco'
import { createModelFileMirror } from '@/lib/monaco/model-file-mirror'
import { createCustomStatusBar } from '@/lib/statusbar'
import type { StatusBarHandle } from '@/lib/statusbar'
import { subscribeLspStatus } from '@/lib/lsp'
import { TestI18nProvider } from '@/modules/i18n/test-i18n'
import { MonacoEditorReactComp } from './EditorWrapper'
import type { MonacoEditorHandle } from './EditorWrapper'

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
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
const ensureMonacoThemeSync = vi.hoisted(() => vi.fn())
const ensureMonacoFontRemeasure = vi.hoisted(() => vi.fn())
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

vi.mock('@/lib/monaco/theme-sync', () => ({
  ensureMonacoThemeSync,
}))

vi.mock('@/lib/monaco/font-remeasure', () => ({
  ensureMonacoFontRemeasure,
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
  createEditorAppConfig: vi.fn((code?: string, _locale?: string, uriHint?: string, presentation?: Record<string, unknown>) => ({
    codeResources: {
      modified: {
        text: code ?? '',
        uri: `file:///playground/${uriHint ?? 'src'}/main.cj`,
        enforceLanguageId: 'cangjie',
      },
    },
    editorOptions: { language: 'cangjie', fixedOverflowWidgets: true, ...(presentation ?? {}) },
  })),
  createLanguageClient: vi.fn(),
  createMonacoVscodeApiConfig: vi.fn(() => ({})),
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
    ensureMonacoThemeSync.mockReset()
    ensureMonacoFontRemeasure.mockReset()
    configureMonacoWorkers.mockReset()
    acquireLanguageService.mockReset().mockReturnValue(vi.fn(async () => {}))
    isLanguageClientAvailable.mockReset().mockReturnValue(true)
    vi.mocked(createCustomStatusBar).mockReset().mockImplementation(async parent => createStatusBarHandle(parent))
    vi.mocked(subscribeLspStatus).mockReset().mockReturnValue(vi.fn())
    vi.mocked(createModelFileMirror).mockReset().mockImplementation(async () => ({
      update: modelFileMirrorUpdate,
      dispose: modelFileMirrorDispose,
    }))
    monacoEditorGetModel.mockReset().mockReturnValue(undefined)
    monacoEditorCreateModel.mockReset().mockImplementation((_text, _language, uri) => ({
      dispose: vi.fn(),
      onDidChangeContent: vi.fn(() => ({ dispose: vi.fn() })),
      getLanguageId: vi.fn(() => 'cangjie'),
      getValue: vi.fn(() => 'main() {}'),
      isDisposed: vi.fn(() => false),
      uri,
    }))
    monacoEditorCreate.mockReset().mockImplementation(() => ({
      dispose: vi.fn(),
      getModel: vi.fn(),
      layout: vi.fn(),
      setModel: vi.fn(),
      updateOptions: vi.fn(),
    }))
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
    expect(ensureMonacoThemeSync).toHaveBeenCalled()
    expect(ensureMonacoFontRemeasure).toHaveBeenCalled()
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

  it.each(['default', 'unresolved'] as const)('uses flex container layout without manual statusbar subtraction for a %s host', async (host) => {
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
    const rootEl = view.container.firstElementChild!
    const editorCanvas = rootEl.firstElementChild!
    vi.spyOn(editorCanvas, 'getBoundingClientRect').mockReturnValue({ width: 640, height: 298 } as DOMRect)

    await act(async () => {
      monacoInit.resolve()
      await monacoInit.promise
    })

    const editor = monacoEditorCreate.mock.results.at(-1)!.value
    expect(createCustomStatusBar).toHaveBeenCalledWith(rootEl, {
      position: 'bottom',
      height: 22,
      compactHeight: 44,
    })
    expect(editor.layout).toHaveBeenLastCalledWith({ width: 640, height: 298 }, true)
    expect(observe.mock.calls).toEqual([[editorCanvas]])
  })

  it('mounts the status control externally and disposes cleanly on unmount', async () => {
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
    const editorCanvas = view.container.firstElementChild!.firstElementChild!
    const externalHost = statusBarHostRef.current!
    vi.spyOn(editorCanvas, 'getBoundingClientRect').mockReturnValue({ width: 640, height: 320 } as DOMRect)

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
    expect(observe.mock.calls).toEqual([[editorCanvas]])
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

  it('coalesces resize notifications, skips unchanged frames, and supports forced relayout()', async () => {
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
    let handle: MonacoEditorHandle | undefined
    const view = render(
      <MonacoEditorReactComp
        code="main() {}"
        onLoad={(loadedHandle) => {
          handle = loadedHandle
        }}
      />,
    )
    let width = 640
    const editorCanvas = view.container.firstElementChild!.firstElementChild!
    vi.spyOn(editorCanvas, 'getBoundingClientRect').mockImplementation(() => ({ width, height: 320 } as DOMRect))
    await act(async () => {
      monacoInit.resolve()
      await monacoInit.promise
    })
    const editor = monacoEditorCreate.mock.results.at(-1)!.value
    expect(editor.layout).toHaveBeenCalledTimes(2)
    expect(editor.layout).toHaveBeenLastCalledWith({ width: 640, height: 320 }, true)

    notifyResize()
    flushFrames()
    expect(editor.layout).toHaveBeenCalledTimes(2)

    // Forced relayout() always lays out even when dimensions match lastLayout.
    handle?.relayout?.()
    expect(editor.layout).toHaveBeenCalledTimes(3)
    expect(editor.layout).toHaveBeenLastCalledWith({ width: 640, height: 320 }, true)

    width = 720
    notifyResize()
    notifyResize()
    notifyResize()
    expect(frames.size).toBe(1)
    expect(editor.layout).toHaveBeenCalledTimes(3)
    flushFrames()
    expect(editor.layout).toHaveBeenCalledTimes(4)
    expect(editor.layout).toHaveBeenLastCalledWith({ width: 720, height: 320 }, true)

    notifyResize()
    view.unmount()
    expect(frames.size).toBe(0)
    expect(cancelAnimationFrame).toHaveBeenCalledOnce()
    flushFrames()
    expect(editor.layout).toHaveBeenCalledTimes(4)
  })

  it('survives React StrictMode double-mount without deadlocking', async () => {
    isLanguageClientAvailable.mockReturnValue(false)
    const onLoad = vi.fn()
    const view = render(
      <StrictMode>
        <MonacoEditorReactComp code="main() {}" locale="zh" uriHint="strict-test" onLoad={onLoad} />
      </StrictMode>,
    )

    await act(async () => {
      monacoInit.resolve()
      await monacoInit.promise
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(monacoEditorCreate).toHaveBeenCalledOnce()
    expect(onLoad).toHaveBeenCalledOnce()
    view.unmount()
  })

  it('re-initializes cleanly when enableLanguageClient toggles', async () => {
    const onLoad = vi.fn()
    const view = render(
      <MonacoEditorReactComp code="main() {}" enableLanguageClient={false} onLoad={onLoad} />,
    )

    await act(async () => {
      monacoInit.resolve()
      await monacoInit.promise
      await Promise.resolve()
    })

    expect(monacoEditorCreate).toHaveBeenCalledTimes(1)
    expect(acquireLanguageService).not.toHaveBeenCalled()
    const firstEditor = monacoEditorCreate.mock.results[0]!.value

    view.rerender(
      <MonacoEditorReactComp code="main() {}" enableLanguageClient onLoad={onLoad} />,
    )
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(firstEditor.dispose).toHaveBeenCalledOnce()
    expect(monacoEditorCreate).toHaveBeenCalledTimes(2)
    expect(acquireLanguageService).toHaveBeenCalledOnce()
    expect(onLoad).toHaveBeenCalledTimes(2)
  })

  it('drops stale concurrent updateCodeResources calls using an epoch guard', async () => {
    isLanguageClientAvailable.mockReturnValue(false)
    let handle: MonacoEditorHandle | undefined
    render(
      <MonacoEditorReactComp
        code="main() {}"
        uriHint="a"
        onLoad={(loadedHandle) => {
          handle = loadedHandle
        }}
      />,
    )

    await act(async () => {
      monacoInit.resolve()
      await monacoInit.promise
      await Promise.resolve()
    })

    const editor = monacoEditorCreate.mock.results.at(-1)!.value
    const slowMirrorB = deferred<{ update: () => void, dispose: () => Promise<void> }>()
    const disposeB = vi.fn(async () => {})
    const disposeC = vi.fn(async () => {})

    vi.mocked(createModelFileMirror)
      .mockImplementationOnce(() => slowMirrorB.promise)
      .mockImplementationOnce(async () => ({ update: vi.fn(), dispose: disposeC }))

    const reqB = handle!.updateCodeResources!({
      modified: { uri: 'file:///playground/b/main.cj', text: 'b', enforceLanguageId: 'cangjie' },
    })
    const reqC = handle!.updateCodeResources!({
      modified: { uri: 'file:///playground/c/main.cj', text: 'c', enforceLanguageId: 'cangjie' },
    })

    await expect(reqC).resolves.toBe(true)
    slowMirrorB.resolve({ update: vi.fn(), dispose: disposeB })
    await expect(reqB).resolves.toBe(false)

    expect(disposeB).toHaveBeenCalledOnce()
    expect(disposeC).not.toHaveBeenCalled()
    expect(editor.setModel).toHaveBeenCalledOnce()
    expect(editor.setModel.mock.calls[0]?.[0].uri.toString()).toBe('file:///playground/c/main.cj')
  })

  it('surfaces initialization errors via onError and recovers when Retry is clicked', async () => {
    isLanguageClientAvailable.mockReturnValue(false)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const failure = new Error('WASM worker blocked')
    vscodeWrapperStart
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(undefined)

    const onError = vi.fn()
    const onLoad = vi.fn()
    render(
      <TestI18nProvider locale="en">
        <MonacoEditorReactComp code="main() {}" locale="en" onError={onError} onLoad={onLoad} />
      </TestI18nProvider>,
    )

    await act(async () => {
      monacoInit.resolve()
      await monacoInit.promise
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(onError).toHaveBeenCalledWith(failure)
    expect(onLoad).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toBeDefined()
    expect(screen.getByText('WASM worker blocked')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(onLoad).toHaveBeenCalledOnce()
    expect(screen.queryByRole('alert')).toBeNull()
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
    expect(vscodeWrapperInitExtensions).not.toHaveBeenCalled()
    expect(monacoEditorCreate).toHaveBeenCalled()
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

    expect(monacoEditorCreate).toHaveBeenCalled()
    expect(onLoad).toHaveBeenCalled()
    expect(vscodeWrapperStart).toHaveBeenCalled()
    expect(acquireLanguageService).not.toHaveBeenCalled()
  })

  it('keeps an unhinted editor on the canonical project model', () => {
    render(<MonacoEditorReactComp code="main() {}" />)

    expect(createEditorAppConfig).toHaveBeenCalledWith('main() {}', undefined, undefined)
  })

  it('forwards compact presentation options to createEditorAppConfig', () => {
    render(<MonacoEditorReactComp code="main() {}" compact />)

    expect(createEditorAppConfig).toHaveBeenCalledWith('main() {}', undefined, undefined, {
      compact: true,
      wordWrap: undefined,
      scrollBeyondLastLine: undefined,
      alwaysConsumeMouseWheel: undefined,
    })
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
