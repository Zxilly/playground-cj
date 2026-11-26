'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import { Button } from '@/components/ui/button'
import { MonacoEditorReactComp } from '@/modules/cangjie-editor/components/EditorWrapper'
import type { MonacoEditorHandle } from '@/modules/cangjie-editor/components/EditorWrapper'
import { EditorBridgeProvider } from '@/modules/cangjie-editor/context/EditorBridgeProvider'
import { useCodeRunner } from '@/modules/cangjie-editor/hooks/useCodeRunner'
import { registerEditorActions } from '@/lib/monaco/actions'
import { clearCompilerMarkers, setCompilerMarkers } from '@/lib/monaco/compiler-markers'
import { cn } from '@/lib/utils'
import type { CangjieEditorProps } from './CangjieEditor'
import { CangjieEditorLoadingState } from './CangjieEditorLoadingState'

const COMPILER_MARKERS_OWNER = 'teach-cangjie-compiler'

/**
 * Long-lived Monaco-backed editor shared by Exercise Instances and Playground.
 *
 * Each surface gets a stable `uriHint`, so independent drafts never share a
 * Monaco model. The read-only Lesson Orchestrator bridge can inspect the active
 * buffer, while writes remain learner-controlled.
 *
 * Excluded from coverage (like the other Monaco wrappers) and only exercised in
 * the browser/e2e projects, since Monaco does not render under jsdom — the block
 * is unit-tested with an injected `<textarea>` fake instead.
 */
export function CangjieMonacoEditor({
  initialCode,
  handleRef,
  locale,
  uriHint: stableUriHint,
  modelScope,
  fillHeight = false,
  compact = false,
  canonicalModel = false,
  replaceCodeOnMount = false,
  onCodeChange,
  onRun,
  onSave,
}: CangjieEditorProps) {
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [retryEpoch, setRetryEpoch] = useState(0)
  const { format } = useCodeRunner()
  const actionsRef = useRef<{ dispose: () => void } | null>(null)
  const monacoHandleRef = useRef<MonacoEditorHandle | null>(null)
  const contentSubscriptionRef = useRef<{ dispose: () => void } | null>(null)
  const onCodeChangeRef = useRef(onCodeChange)
  onCodeChangeRef.current = onCodeChange
  const onRunRef = useRef(onRun)
  onRunRef.current = onRun
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave
  const hasRun = onRun !== undefined
  const hasSave = onSave !== undefined
  // Callers supply a domain-stable identity. The fallback isolates standalone
  // mounts without retaining them.
  const reactId = useId()
  const uriHint = canonicalModel
    ? undefined
    : stableUriHint ?? `teach-cangjie-editor-${reactId.replace(/[^\w-]/g, '')}`

  // Publish the imperative handle used by the owning surface and read-only
  // active-editor registry.
  useEffect(() => {
    handleRef.current = {
      getCode: () => monacoHandleRef.current?.getEditor()?.getModel()?.getValue() ?? initialCode,
      setCode: (code: string) => {
        monacoHandleRef.current?.getEditor()?.getModel()?.setValue(code)
      },
      layout: () => {
        if (monacoHandleRef.current?.relayout)
          monacoHandleRef.current.relayout()
        else
          monacoHandleRef.current?.getEditor()?.layout()
      },
      relayout: () => {
        monacoHandleRef.current?.relayout?.()
      },
      format: async () => {
        await monacoHandleRef.current?.getEditor()?.getAction('editor.action.formatDocument')?.run()
      },
      setCompilerMarkers: (output: string) => {
        const model = monacoHandleRef.current?.getEditor()?.getModel()
        if (model)
          setCompilerMarkers(model, COMPILER_MARKERS_OWNER, output)
      },
      clearCompilerMarkers: () => {
        const model = monacoHandleRef.current?.getEditor()?.getModel()
        if (model)
          clearCompilerMarkers(model, COMPILER_MARKERS_OWNER)
      },
    }
    return () => {
      handleRef.current = null
    }
  }, [handleRef, initialCode])

  const onLoad = useCallback((handle: MonacoEditorHandle) => {
    contentSubscriptionRef.current?.dispose()
    monacoHandleRef.current = handle
    const editor = handle.getEditor()
    actionsRef.current?.dispose()
    actionsRef.current = editor
      ? registerEditorActions(editor, {
          format,
          run: hasRun ? (code, signal) => onRunRef.current?.(code, signal) : undefined,
          onSave: hasSave ? (code, signal) => onSaveRef.current?.(code, signal) : undefined,
        })
      : null
    if (replaceCodeOnMount)
      editor?.getModel()?.setValue(initialCode)
    contentSubscriptionRef.current = editor?.onDidChangeModelContent(() => {
      const code = editor.getModel()?.getValue()
      if (code !== undefined)
        onCodeChangeRef.current?.(code)
    }) ?? null
    setLoadError(null)
    setReady(true)
  }, [format, hasRun, hasSave, initialCode, replaceCodeOnMount])

  const onError = useCallback((error: Error) => {
    setLoadError(error)
    setReady(false)
  }, [])

  const retryLoad = useCallback(() => {
    setLoadError(null)
    setReady(false)
    setRetryEpoch(epoch => epoch + 1)
  }, [])

  useEffect(() => () => {
    contentSubscriptionRef.current?.dispose()
    contentSubscriptionRef.current = null
    actionsRef.current?.dispose()
  }, [])

  return (
    <EditorBridgeProvider lang={locale}>
      {/*
        The wrapper positions Monaco absolutely, so the container's height drives
        the editor size. A flat h-64 only fit ~10 lines; give it a roomier default
        and let the learner drag the bottom edge taller for longer tasks
        (resize-y needs a non-visible overflow to show the handle).
      */}
      <div
        aria-busy={!ready && !loadError}
        className={cn(
          'relative w-full overflow-hidden bg-editor-surface',
          fillHeight ? 'h-full min-h-0' : 'h-80 min-h-56 resize-y',
        )}
      >
        <MonacoEditorReactComp
          key={retryEpoch}
          code={initialCode}
          locale={locale}
          compact={compact}
          onLoad={onLoad}
          onError={onError}
          uriHint={uriHint}
          modelScope={modelScope}
          retainModelOnUnmount={modelScope != null}
        />
        {!ready && !loadError && (
          <div className="absolute inset-0 z-10">
            <CangjieEditorLoadingState />
          </div>
        )}
        {loadError && (
          <div
            role="alert"
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-editor-surface/95 p-4 text-center text-sm"
          >
            <AlertCircle aria-hidden="true" className="size-6 text-error-foreground" />
            <p className="font-medium text-foreground">
              <Trans>代码编辑器加载失败</Trans>
            </p>
            <p className="max-w-sm text-xs text-muted-foreground">
              {loadError.message}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={retryLoad}
              className="min-h-11 lg:min-h-8"
            >
              <RefreshCw aria-hidden="true" className="size-3.5" />
              <span><Trans>重试</Trans></span>
            </Button>
          </div>
        )}
      </div>
    </EditorBridgeProvider>
  )
}
