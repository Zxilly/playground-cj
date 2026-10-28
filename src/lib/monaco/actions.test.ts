import type * as monaco from '@codingame/monaco-vscode-editor-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  provider: undefined as monaco.languages.DocumentFormattingEditProvider | undefined,
  register: vi.fn(),
}))

vi.mock('@codingame/monaco-vscode-editor-api', () => ({
  KeyMod: { CtrlCmd: 2048, Shift: 1024 },
  KeyCode: { KeyB: 32, KeyS: 49, Enter: 3 },
  languages: {
    registerDocumentFormattingEditProvider: (_language: string, provider: monaco.languages.DocumentFormattingEditProvider) => {
      mocks.provider = provider
      mocks.register()
      return { dispose: vi.fn() }
    },
  },
}))
vi.mock('@/lib/hmr-store', () => ({ HMR_SLOT_KEYS: {}, hmrSlot: (_key: string, create: () => unknown) => create() }))

function createEditor(initial = 'main(){}') {
  let version = 1
  let source = initial
  const model = {
    getValue: () => source,
    getVersionId: () => version,
    isDisposed: () => false,
    getFullModelRange: () => ({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: source.length + 1 }),
    setValue: vi.fn((next: string) => {
      source = next
      version++
    }),
  } as unknown as monaco.editor.ITextModel
  const actions = new Map<string, monaco.editor.IActionDescriptor>()
  const disposeActions = vi.fn()
  const editor = {
    getModel: () => model,
    getValue: () => source,
    addAction: (action: monaco.editor.IActionDescriptor) => {
      actions.set(action.id, action)
      return { dispose: disposeActions }
    },
    onDidDispose: () => ({ dispose: vi.fn() }),
  } as unknown as monaco.editor.IStandaloneCodeEditor
  return { model, actions, editor, disposeActions }
}

function cancellation() {
  let callback: (() => void) | undefined
  const dispose = vi.fn()
  const token: monaco.CancellationToken = {
    isCancellationRequested: false,
    onCancellationRequested: (listener) => {
      callback = listener
      return { dispose }
    },
  }
  return {
    token,
    dispose,
    cancel: () => {
      callback?.()
    },
  }
}

function provide(model: monaco.editor.ITextModel, token = cancellation().token) {
  return Promise.resolve(mocks.provider!.provideDocumentFormattingEdits(model, { tabSize: 4, insertSpaces: true }, token))
}

describe('editor capabilities', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.provider = undefined
    mocks.register.mockClear()
  })

  it('registers only surface-owned commands and disposes their scope', async () => {
    const { registerEditorActions } = await import('./actions')
    const { editor, actions, disposeActions } = createEditor()
    const run = vi.fn()
    const registration = registerEditorActions(editor, { run })
    expect([...actions.keys()]).toEqual(['cangjie.compile.run'])
    expect(actions.get('cangjie.compile.run')!.keybindings).toEqual([2048 | 32, 1024 | 3])
    await actions.get('cangjie.compile.run')!.run(editor)
    const signal = run.mock.calls[0][1] as AbortSignal
    expect(run).toHaveBeenCalledWith('main(){}', signal)
    expect(signal.aborted).toBe(false)
    registration.dispose()
    expect(signal.aborted).toBe(true)
    expect(disposeActions).toHaveBeenCalledOnce()
  })

  it('returns Monaco edits instead of directly replacing the model and shares one provider', async () => {
    const { registerEditorActions } = await import('./actions')
    const first = createEditor('first')
    const second = createEditor('second')
    registerEditorActions(first.editor, { format: async () => 'formatted first' })
    registerEditorActions(second.editor, { format: async () => 'formatted second' })
    expect(mocks.register).toHaveBeenCalledOnce()
    await expect(provide(first.model)).resolves.toEqual([{ range: first.model.getFullModelRange(), text: 'formatted first' }])
    await expect(provide(second.model)).resolves.toEqual([{ range: second.model.getFullModelRange(), text: 'formatted second' }])
    expect(first.model.setValue).not.toHaveBeenCalled()
    expect(second.model.setValue).not.toHaveBeenCalled()
  })

  it('rejects formatter failures instead of leaving Monaco waiting for a completion event', async () => {
    const { registerEditorActions } = await import('./actions')
    const { editor, model } = createEditor()
    const failure = new Error('formatter rejected source')
    registerEditorActions(editor, { format: () => Promise.reject(failure) })
    const { token, dispose } = cancellation()
    await expect(provide(model, token)).rejects.toBe(failure)
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('settles cancellation even when the formatter ignores its signal', async () => {
    const { registerEditorActions } = await import('./actions')
    const { editor, model } = createEditor()
    registerEditorActions(editor, { format: () => new Promise(() => {}) })
    const { token, cancel, dispose } = cancellation()
    const pending = provide(model, token)
    cancel()
    await expect(pending).resolves.toEqual([])
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('ignores a format result after the learner edits the source', async () => {
    const { registerEditorActions } = await import('./actions')
    const { editor, model } = createEditor()
    let finish!: (source: string) => void
    registerEditorActions(editor, {
      format: () => new Promise((resolve) => {
        finish = resolve
      }),
    })
    const pending = provide(model)
    model.setValue('new learner draft')
    finish('outdated formatted draft')
    await expect(pending).resolves.toEqual([])
    expect(model.getValue()).toBe('new learner draft')
  })

  it('cancels formatting when its owner is disposed and releases the provider entry', async () => {
    const { registerEditorActions } = await import('./actions')
    const { editor, model } = createEditor()
    const registration = registerEditorActions(editor, { format: () => new Promise(() => {}) })
    const pending = provide(model)
    registration.dispose()
    await expect(pending).resolves.toEqual([])
    await expect(provide(model)).resolves.toEqual([])
  })
})
