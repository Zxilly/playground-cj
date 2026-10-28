import * as monaco from '@codingame/monaco-vscode-editor-api'
import { t } from '@lingui/core/macro'
import { abortable } from '@/lib/abortable'
import { HMR_SLOT_KEYS, hmrSlot } from '@/lib/hmr-store'
import { CANGJIE_LANGUAGE_ID } from './language'

type EditorCommand = (code: string, signal: AbortSignal) => void | Promise<void>

export interface EditorCapabilities {
  run?: EditorCommand
  format?: (code: string, signal: AbortSignal) => Promise<string>
  shareUrl?: EditorCommand
  shareHash?: EditorCommand
  save?: EditorCommand
}

interface EditorRegistration {
  capabilities: EditorCapabilities
  lifetime: AbortController
}

interface FormattingState {
  provider?: monaco.IDisposable
  editors: Map<monaco.editor.IStandaloneCodeEditor, EditorRegistration>
}

const formatting = hmrSlot<FormattingState>(HMR_SLOT_KEYS.MONACO_CANGJIE_FORMATTING_PROVIDER, () => ({
  editors: new Map(),
}))

function ensureFormattingProvider() {
  if (formatting.provider)
    return
  formatting.provider = monaco.languages.registerDocumentFormattingEditProvider(CANGJIE_LANGUAGE_ID, {
    async provideDocumentFormattingEdits(model, _options, token) {
      const entry = [...formatting.editors].find(([editor, registration]) =>
        editor.getModel() === model && registration.capabilities.format,
      )?.[1]
      if (!entry?.capabilities.format || token.isCancellationRequested)
        return []
      const cancellation = new AbortController()
      const subscription = token.onCancellationRequested(() => cancellation.abort())
      const signal = AbortSignal.any([cancellation.signal, entry.lifetime.signal])
      const version = model.getVersionId()
      const source = model.getValue()
      try {
        signal.throwIfAborted()
        const formatted = await abortable(entry.capabilities.format(source, signal), signal)
        // Monaco applies these edits itself, preserving undo. Ignore stale work
        // when the learner types, changes models or closes this editor meanwhile.
        if (signal.aborted || model.isDisposed() || model.getVersionId() !== version || formatted === source)
          return []
        if (![...formatting.editors.keys()].some(editor => editor.getModel() === model))
          return []
        window.umami?.track('format')
        return [{ range: model.getFullModelRange(), text: formatted }]
      }
      catch (error) {
        if (signal.aborted)
          return []
        throw error
      }
      finally {
        subscription.dispose()
      }
    },
  })
}

/** Register only capabilities owned by this surface; release them on unmount. */
export function registerEditorActions(
  editor: monaco.editor.IStandaloneCodeEditor,
  capabilities: EditorCapabilities,
): monaco.IDisposable {
  const registration = { capabilities, lifetime: new AbortController() }
  formatting.editors.set(editor, registration)
  if (capabilities.format)
    ensureFormattingProvider()
  const actions: monaco.IDisposable[] = []
  const add = (id: string, label: string, command: EditorCommand | undefined, tracking: string, keybindings?: number[]) => {
    if (!command)
      return
    actions.push(editor.addAction({
      id,
      label,
      contextMenuGroupId: 'cangjie',
      contextMenuOrder: 1.5,
      keybindings,
      run: (target) => {
        window.umami?.track(tracking)
        return command(target.getValue(), registration.lifetime.signal)
      },
    }))
  }
  add('cangjie.compile.run', t`编译运行`, capabilities.run, 'run', [
    monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB,
    monaco.KeyMod.Shift | monaco.KeyCode.Enter,
  ])
  add('cangjie.share.url', t`分享完整链接`, capabilities.shareUrl, 'share.url')
  add('cangjie.share.hash', t`分享短链接`, capabilities.shareHash, 'share.hash')
  add('cangjie.save', t`保存代码`, capabilities.save, 'save', [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS])
  let disposed = false
  const dispose = () => {
    if (disposed)
      return
    disposed = true
    registration.lifetime.abort(new DOMException('Editor actions disposed', 'AbortError'))
    if (formatting.editors.get(editor) === registration)
      formatting.editors.delete(editor)
    for (const action of actions)
      action.dispose()
  }
  actions.push(editor.onDidDispose(dispose))
  return { dispose }
}

import.meta.webpackHot?.accept()
