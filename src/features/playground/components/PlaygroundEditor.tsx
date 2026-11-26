'use client'

import { use, useCallback, useEffect, useMemo, useRef } from 'react'
import { t } from '@lingui/core/macro'
import { toast } from 'sonner'
import { MonacoEditorReactComp } from '@/modules/cangjie-editor/components/EditorWrapper'
import type { MonacoEditorHandle, MonacoEditorProps } from '@/modules/cangjie-editor/components/EditorWrapper'
import { registerEditorActions } from '@/lib/monaco/actions'
import { compilerMarkers } from '@/lib/monaco/compiler-markers'
import * as monaco from '@codingame/monaco-vscode-editor-api'
import { abortable } from '@/lib/abortable'
import { getLocalizedExamples } from '@/const'
import type { ShareCodeLoadError, ShareCodeResult } from '@/lib/dpaste-server'
import { generateDataShareUrl, generateHashShareUrl, loadDataShareCode, loadLegacyShareCode } from '@/service/share'
import { loadPlaygroundDraft, savePlaygroundDraft, usePlaygroundStore } from '@/stores/playground'
import type { PlaygroundCodeOrigin } from '@/stores/playground'
import { useCodeRunner } from '@/modules/cangjie-editor/hooks/useCodeRunner'

interface PlaygroundEditorProps extends MonacoEditorProps {
  sharedCode?: Promise<ShareCodeResult | string | undefined>
}

const DRAFT_SAVE_DEBOUNCE_MS = 300

function shareLoadErrorMessage(reason: ShareCodeLoadError): string {
  switch (reason) {
    case 'invalid_hash':
      return t`分享短链接格式无效，已为你加载默认代码。`
    case 'not_found':
      return t`分享短链接已过期或不存在，已为你加载默认代码。`
    case 'timeout':
      return t`获取分享代码超时，请稍后刷新重试。`
    case 'unavailable':
    default:
      return t`分享服务暂时不可用，已为你加载默认代码。`
  }
}

export default function PlaygroundEditor({ sharedCode, onLoad, onError, locale, ...props }: PlaygroundEditorProps) {
  const resolvedShared = sharedCode ? use(sharedCode) : undefined
  const sharedResult = useMemo<ShareCodeResult | undefined>(() => (
    typeof resolvedShared === 'string'
      ? { ok: true, code: resolvedShared }
      : resolvedShared
  ), [resolvedShared])

  const initialSeed = useMemo<{ code: string | undefined, origin: PlaygroundCodeOrigin }>(() => {
    if (sharedResult?.ok)
      return { code: sharedResult.code, origin: 'shared' }

    const dataShare = loadDataShareCode()
    if (dataShare !== undefined)
      return { code: dataShare, origin: 'shared' }

    if (props.code !== undefined)
      return { code: props.code, origin: 'custom' }

    const hasLegacyHash = typeof window !== 'undefined'
      && new URLSearchParams(window.location.hash.slice(1)).has('hash')
    if (!hasLegacyHash) {
      const draft = loadPlaygroundDraft()
      if (draft !== undefined)
        return { code: draft, origin: 'draft' }
    }

    return { code: undefined, origin: 'example' }
  }, [props.code, sharedResult])

  const actionsRef = useRef<{ dispose: () => void } | null>(null)
  const contentChangeRef = useRef<{ dispose: () => void } | null>(null)
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const loadAbortRef = useRef<AbortController | null>(null)
  const runAbortRef = useRef<AbortController | null>(null)
  const notifiedShareErrorRef = useRef<string | null>(null)

  const store = usePlaygroundStore.getState()
  const compilerOutput = usePlaygroundStore(state => state.toolOutput)

  const { run, format } = useCodeRunner({
    outputs: {
      setToolOutput: store.setToolOutput,
      setProgramOutput: store.setProgramOutput,
      setTruncation: store.setTruncation,
      setResult: store.setRunResult,
      getStdin: () => {
        const value = usePlaygroundStore.getState().stdin
        return value.length > 0 ? value : undefined
      },
    },
    onRunningChange: store.setRunning,
  })

  useEffect(() => {
    if (!sharedResult || sharedResult.ok)
      return
    const errorKey = `${sharedResult.reason}:${sharedResult.status ?? ''}`
    if (notifiedShareErrorRef.current === errorKey)
      return
    notifiedShareErrorRef.current = errorKey
    toast.error(shareLoadErrorMessage(sharedResult.reason))
  }, [sharedResult])

  useEffect(() => {
    const state = usePlaygroundStore.getState()
    if (initialSeed.origin === 'example') {
      const defaultExample = getLocalizedExamples(locale)['hello-world']
      state.setExampleSelection('hello-world', defaultExample?.name ?? 'Hello World', 'example')
    }
    else {
      state.setExampleSelection(null, null, initialSeed.origin)
    }
  }, [initialSeed.origin, locale])

  const handleEditorError = useCallback((error: Error) => {
    usePlaygroundStore.getState().setEditorError(error)
    onError?.(error)
  }, [onError])

  const handleLoad = useCallback((editorApp: MonacoEditorHandle) => {
    const editor = editorApp.getEditor()!
    editorRef.current = editor
    usePlaygroundStore.getState().setEditorError(null)
    actionsRef.current?.dispose()
    actionsRef.current = registerEditorActions(editor, {
      run: async (source, signal) => {
        runAbortRef.current?.abort()
        const controller = new AbortController()
        runAbortRef.current = controller
        const combinedSignal = AbortSignal.any([signal, controller.signal])
        usePlaygroundStore.getState().setCancelRun(() => {
          controller.abort(new DOMException('Cancelled by user', 'AbortError'))
        })
        try {
          await run(source, combinedSignal)
        }
        catch (error) {
          if (controller.signal.aborted && !signal.aborted) {
            usePlaygroundStore.getState().setToolOutput(t`已取消运行`)
            usePlaygroundStore.getState().setProgramOutput('')
            toast.info(t`已取消运行`)
            return
          }
          throw error
        }
        finally {
          if (runAbortRef.current === controller) {
            runAbortRef.current = null
            usePlaygroundStore.getState().setCancelRun(null)
          }
        }
      },
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
            toast.error(t`短链接创建失败，请改用「完整链接」分享。`, { id: notification })
          throw error
        }
      },
      onSave: (source) => {
        if (draftSaveTimerRef.current) {
          clearTimeout(draftSaveTimerRef.current)
          draftSaveTimerRef.current = null
        }
        savePlaygroundDraft(source)
        toast.success(t`已保存草稿到本地`)
      },
    })

    const model = editor.getModel()
    if (model) {
      monaco.editor.setModelMarkers(
        model,
        'playground-run',
        compilerMarkers(usePlaygroundStore.getState().toolOutput, model),
      )

      contentChangeRef.current?.dispose()
      contentChangeRef.current = model.onDidChangeContent(() => {
        const value = model.getValue()
        const state = usePlaygroundStore.getState()
        if (state.selectedExampleKey) {
          const exampleContent = getLocalizedExamples(locale)[state.selectedExampleKey]?.content
          if (exampleContent !== undefined && value !== exampleContent)
            state.setExampleSelection(null, null, 'custom')
        }

        if (draftSaveTimerRef.current)
          clearTimeout(draftSaveTimerRef.current)
        draftSaveTimerRef.current = setTimeout(() => {
          draftSaveTimerRef.current = null
          savePlaygroundDraft(model.getValue())
        }, DRAFT_SAVE_DEBOUNCE_MS)
      })
    }

    onLoad?.(editorApp)

    // Legacy hash links belong to this surface. Never replace edits made while
    // their request is in flight, or publish into a newly mounted workspace.
    if (!new URLSearchParams(window.location.hash.slice(1)).has('hash'))
      return
    loadAbortRef.current?.abort()
    const loadAbort = new AbortController()
    loadAbortRef.current = loadAbort
    const version = model?.getVersionId()
    const notification = toast.loading(t`分享代码加载中...`)
    void abortable(loadLegacyShareCode(), loadAbort.signal).then(([source, success]) => {
      if (!success)
        throw new Error('Shared source could not be loaded')
      if (model && !model.isDisposed() && editor.getModel() === model && model.getVersionId() === version) {
        editor.pushUndoStop()
        editor.executeEdits('playground.legacy-share', [{ range: model.getFullModelRange(), text: source }])
        editor.pushUndoStop()
        usePlaygroundStore.getState().setExampleSelection(null, null, 'shared')
      }
      usePlaygroundStore.getState().setToolOutput(t`分享代码加载成功`)
      toast.success(t`分享代码加载成功`, { id: notification })
    }).catch(() => {
      if (loadAbort.signal.aborted) {
        toast.dismiss(notification)
        return
      }
      usePlaygroundStore.getState().setToolOutput(t`分享代码加载失败`)
      toast.error(t`分享代码加载失败，短链接可能已过期或服务暂时不可用。`, { id: notification })
    })
  }, [format, locale, onLoad, run])

  useEffect(() => () => {
    actionsRef.current?.dispose()
    contentChangeRef.current?.dispose()
    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current)
      draftSaveTimerRef.current = null
    }
    loadAbortRef.current?.abort()
    runAbortRef.current?.abort()
    usePlaygroundStore.getState().setCancelRun(null)
    const model = editorRef.current?.getModel()
    if (model && !model.isDisposed())
      monaco.editor.setModelMarkers(model, 'playground-run', [])
  }, [])

  useEffect(() => {
    const model = editorRef.current?.getModel()
    if (model)
      monaco.editor.setModelMarkers(model, 'playground-run', compilerMarkers(compilerOutput, model))
  }, [compilerOutput])

  return (
    <MonacoEditorReactComp
      {...props}
      locale={locale}
      code={initialSeed.code}
      onLoad={handleLoad}
      onError={handleEditorError}
    />
  )
}
