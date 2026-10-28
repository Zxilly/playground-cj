import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as monaco from '@codingame/monaco-vscode-editor-api'
import { getService } from '@codingame/monaco-vscode-api'
import { IFileService } from '@codingame/monaco-vscode-api/services'
import { createEditorAppConfig } from '@/lib/monaco'
import { registerEditorActions } from '@/lib/monaco/actions'
import type { MonacoEditorHandle } from './EditorWrapper'
import { MonacoEditorReactComp } from './EditorWrapper'

vi.mock('@/app/font', () => ({ fontFamily: 'monospace' }))

function modelUri(hint: string): monaco.Uri {
  const uri = createEditorAppConfig('', 'zh', hint).codeResources?.modified?.uri
  if (!uri)
    throw new Error(`missing model URI for ${hint}`)
  return monaco.Uri.parse(uri)
}

function Editor({ hint, code, onLoad }: { hint: string, code: string, onLoad?: () => void }) {
  return (
    <div style={{ position: 'relative', width: 400, height: 240 }}>
      <MonacoEditorReactComp
        code={code}
        uriHint={hint}
        enableLanguageClient={false}
        onLoad={onLoad}
      />
    </div>
  )
}

afterEach(() => cleanup())

describe('monacoEditorReactComp browser lifecycle', () => {
  it('applies capability formatting through Monaco with undo and redo intact', async () => {
    let resolveLoaded!: (handle: MonacoEditorHandle) => void
    const loaded = new Promise<MonacoEditorHandle>((resolve) => {
      resolveLoaded = resolve
    })
    render(
      <div style={{ position: 'relative', width: 400, height: 240 }}>
        <MonacoEditorReactComp
          code="main(){println(1)}"
          uriHint="browser-format-undo"
          enableLanguageClient={false}
          onLoad={resolveLoaded}
        />
      </div>,
    )
    const editor = (await loaded).getEditor()!
    const registration = registerEditorActions(editor, {
      format: async () => 'main() {\n    println(1)\n}',
    })
    const formatted = ['main() {', '    println(1)', '}'].join(editor.getModel()!.getEOL())
    try {
      await editor.getAction('editor.action.formatDocument')!.run()
      expect(editor.getValue()).toBe(formatted)
      await editor.getModel()!.undo()
      expect(editor.getValue()).toBe('main(){println(1)}')
      await editor.getModel()!.redo()
      expect(editor.getValue()).toBe(formatted)
    }
    finally {
      registration.dispose()
    }
  }, 60_000)

  it('backs a lesson editor model with the VS Code file service and keeps it current', async () => {
    const hint = 'teach:0001:b4'
    const uri = modelUri(hint)
    let resolveLoaded!: () => void
    const loaded = new Promise<void>((resolve) => {
      resolveLoaded = resolve
    })
    render(<Editor hint={hint} code="let value = 1" onLoad={resolveLoaded} />)

    await loaded
    const fileService = await getService(IFileService)
    expect((await fileService.readFile(uri)).value.toString()).toBe('let value = 1')

    monaco.editor.getModel(uri)!.setValue('let value = 2')
    await waitFor(async () => {
      expect((await fileService.readFile(uri)).value.toString()).toBe('let value = 2')
    })
  }, 30_000)

  it('isolates two models and releases only the unmounted instance', async () => {
    const firstUri = modelUri('browser-first')
    const secondUri = modelUri('browser-second')
    let loadedEditors = 0
    let resolveLoaded!: () => void
    const loaded = new Promise<void>((resolve) => {
      resolveLoaded = resolve
    })
    const onLoad = () => {
      loadedEditors += 1
      if (loadedEditors === 2)
        resolveLoaded()
    }
    const view = render(
      <>
        <Editor key="first" hint="browser-first" code="let first = 1" onLoad={onLoad} />
        <Editor key="second" hint="browser-second" code="let second = 2" onLoad={onLoad} />
      </>,
    )

    await loaded
    expect(monaco.editor.getModel(firstUri)?.getValue()).toBe('let first = 1')
    expect(monaco.editor.getModel(secondUri)?.getValue()).toBe('let second = 2')

    monaco.editor.getModel(firstUri)!.setValue('let first = 10')
    expect(monaco.editor.getModel(secondUri)!.getValue()).toBe('let second = 2')

    view.rerender(<Editor key="second" hint="browser-second" code="let second = 2" />)
    await waitFor(() => {
      expect(monaco.editor.getModel(firstUri)).toBeNull()
      expect(monaco.editor.getModel(secondUri)?.getValue()).toBe('let second = 2')
    })

    view.unmount()
    await waitFor(() => expect(monaco.editor.getModel(secondUri)).toBeNull())
  }, 30_000)
})
