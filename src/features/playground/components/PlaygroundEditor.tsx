'use client'

import { use, useCallback, useEffect, useMemo, useRef } from 'react'
import { t } from '@lingui/core/macro'
import { toast } from 'sonner'
import { MonacoEditorReactComp } from '@/modules/cangjie-editor/components/EditorWrapper'
import type { MonacoEditorHandle, MonacoEditorProps } from '@/modules/cangjie-editor/components/EditorWrapper'
import { registerEditorActions } from '@/lib/monaco/actions'
import { compilerMarkers } from '@/lib/monaco/compiler-markers'
import * as monaco from '@codingame/monaco-vscode-editor-api'
import { saveAsFile } from '@/lib/file'
import { abortable } from '@/lib/abortable'
import { generateDataShareUrl, generateHashShareUrl, loadDataShareCode, loadLegacyShareCode } from '@/service/share'
import { usePlaygroundStore } from '@/stores/playground'
import { useCodeRunner } from '@/modules/cangjie-editor/hooks/useCodeRunner'

interface PlaygroundEditorProps extends MonacoEditorProps {
  sharedCode?: Promise<string | undefined>
}

export default function PlaygroundEditor({ sharedCode, onLoad, ...props }: PlaygroundEditorProps) {
  const code = sharedCode ? use(sharedCode) : props.code
  // URL fragments seed the browser-only model before its first creation.
  const renderedCode = useMemo(() => code ?? loadDataShareCode(), [code])
  const actionsRef = useRef<{ dispose: () => void } | null>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const loadAbortRef = useRef<AbortController | null>(null)
  const store = usePlaygroundStore.getState()
  const compilerOutput = usePlaygroundStore(state => state.toolOutput)
  const { run, format } = useCodeRunner({
    outputs: {
      setToolOutput: store.setToolOutput,
      setProgramOutput: store.setProgramOutput,
      setTruncation: store.setTruncation,
      setResult: store.setRunResult,
    },
    onRunningChange: store.setRunning,
  })

  const handleLoad = useCallback((editorApp: MonacoEditorHandle) => {
    const editor = editorApp.getEditor()!
    editorRef.current = editor
    actionsRef.current?.dispose()
    actionsRef.current = registerEditorActions(editor, {
      run,
      format,
      shareUrl: (source) => {
        usePlaygroundStore.getState().openShareDialog(generateDataShareUrl(source))
      },
      shareHash: async (source, signal) => {
        const notification = toast.loading(t`分享中...`)
        try {
          const url = await abortable(generateHashShareUrl(source), signal)
          signal.throwIfAborted()
          usePlaygroundStore.getState().openShareDialog(url)
          toast.success(t`分享成功`, { id: notification })
        }
        catch (error) {
          if (signal.aborted)
            toast.dismiss(notification)
          else
            toast.error(t`分享失败`, { id: notification })
          throw error
        }
      },
      save: (source) => {
        saveAsFile(source)
        toast.success(t`已保存代码`)
      },
    })
    onLoad?.(editorApp)

    // Legacy hash links belong to this surface. Never replace edits made while
    // their request is in flight, or publish into a newly mounted workspace.
    if (!new URLSearchParams(window.location.hash.slice(1)).has('hash'))
      return
    loadAbortRef.current?.abort()
    const loadAbort = new AbortController()
    loadAbortRef.current = loadAbort
    const model = editor.getModel()
    const version = model?.getVersionId()
    const notification = toast.loading(t`分享代码加载中...`)
    void abortable(loadLegacyShareCode(), loadAbort.signal).then(([source, success]) => {
      if (!success)
        throw new Error('Shared source could not be loaded')
      if (model && !model.isDisposed() && editor.getModel() === model && model.getVersionId() === version) {
        editor.pushUndoStop()
        editor.executeEdits('playground.legacy-share', [{ range: model.getFullModelRange(), text: source }])
        editor.pushUndoStop()
      }
      usePlaygroundStore.getState().setToolOutput(t`分享代码加载成功`)
      toast.success(t`分享代码加载成功`, { id: notification })
    }).catch(() => {
      if (loadAbort.signal.aborted) {
        toast.dismiss(notification)
        return
      }
      usePlaygroundStore.getState().setToolOutput(t`分享代码加载失败`)
      toast.error(t`分享代码加载失败`, { id: notification })
    })
  }, [format, onLoad, run])

  useEffect(() => () => {
    actionsRef.current?.dispose()
    loadAbortRef.current?.abort()
    const model = editorRef.current?.getModel()
    if (model && !model.isDisposed())
      monaco.editor.setModelMarkers(model, 'playground-run', [])
  }, [])

  useEffect(() => {
    const model = editorRef.current?.getModel()
    if (model)
      monaco.editor.setModelMarkers(model, 'playground-run', compilerMarkers(compilerOutput, model))
  }, [compilerOutput])

  return <MonacoEditorReactComp {...props} code={renderedCode} onLoad={handleLoad} />
}
