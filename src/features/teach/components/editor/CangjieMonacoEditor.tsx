'use client'

import { useCallback, useEffect, useId, useRef } from 'react'
import { MonacoEditorReactComp } from '@/modules/cangjie-editor/components/EditorWrapper'
import type { MonacoEditorHandle } from '@/modules/cangjie-editor/components/EditorWrapper'
import { EditorBridgeProvider } from '@/modules/cangjie-editor/context/EditorBridgeProvider'
import { cn } from '@/lib/utils'
import type { CangjieEditorProps } from './CangjieEditor'

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
  canonicalModel = false,
  replaceCodeOnMount = false,
  onCodeChange,
}: CangjieEditorProps) {
  const monacoHandleRef = useRef<MonacoEditorHandle | null>(null)
  const contentSubscriptionRef = useRef<{ dispose: () => void } | null>(null)
  const onCodeChangeRef = useRef(onCodeChange)
  onCodeChangeRef.current = onCodeChange
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
        monacoHandleRef.current?.getEditor()?.layout()
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
    if (replaceCodeOnMount)
      editor?.getModel()?.setValue(initialCode)
    contentSubscriptionRef.current = editor?.onDidChangeModelContent(() => {
      const code = editor.getModel()?.getValue()
      if (code !== undefined)
        onCodeChangeRef.current?.(code)
    }) ?? null
  }, [initialCode, replaceCodeOnMount])

  useEffect(() => () => {
    contentSubscriptionRef.current?.dispose()
    contentSubscriptionRef.current = null
  }, [])

  return (
    <EditorBridgeProvider lang={locale ?? 'zh'}>
      {/*
        The wrapper positions Monaco absolutely, so the container's height drives
        the editor size. A flat h-64 only fit ~10 lines; give it a roomier default
        and let the learner drag the bottom edge taller for longer tasks
        (resize-y needs a non-visible overflow to show the handle).
      */}
      <div className={cn(
        'relative w-full overflow-hidden',
        fillHeight ? 'h-full min-h-0' : 'h-80 min-h-56 resize-y',
      )}
      >
        <MonacoEditorReactComp
          code={initialCode}
          locale={locale}
          onLoad={onLoad}
          uriHint={uriHint}
          modelScope={modelScope}
          retainModelOnUnmount={modelScope != null}
        />
      </div>
    </EditorBridgeProvider>
  )
}
