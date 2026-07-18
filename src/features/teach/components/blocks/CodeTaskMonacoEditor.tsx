'use client'

import { useCallback, useEffect, useId, useRef } from 'react'
import { MonacoEditorReactComp } from '@/modules/cangjie-editor/components/EditorWrapper'
import type { MonacoEditorHandle } from '@/modules/cangjie-editor/components/EditorWrapper'
import { EditorBridgeProvider } from '@/modules/cangjie-editor/context/EditorBridgeProvider'
import { cn } from '@/lib/utils'
import type { CodeTaskEditorProps } from './CodeTaskBlock'

/**
 * The real, Monaco-backed editor for a `code_task` block — the same editor module
 * the playground/tour use (via {@link MonacoEditorReactComp}). It reuses the
 * cangjie-editor stack rather than re-implementing a code surface.
 *
 * Each code_task gets a per-instance `uriHint`, so a lesson with several code
 * tasks holds independent Monaco models (and the learner's edits in one survive
 * scrolling past another). The block reads/writes the live buffer through the
 * supplied `handleRef`, backed by the editor model's `getValue()` / `setValue()`
 * — this is exactly what the teacher's `read_editor_code` / `set_editor_code`
 * tools drive once the block registers itself as the active editor.
 *
 * Excluded from coverage (like the other Monaco wrappers) and only exercised in
 * the browser/e2e projects, since Monaco does not render under jsdom — the block
 * is unit-tested with an injected `<textarea>` fake instead.
 */
export function CodeTaskMonacoEditor({
  initialCode,
  handleRef,
  locale,
  uriHint: stableUriHint,
  modelScope,
  fillHeight = false,
  canonicalModel = false,
  replaceCodeOnMount = false,
  onCodeChange,
}: CodeTaskEditorProps) {
  const monacoHandleRef = useRef<MonacoEditorHandle | null>(null)
  const contentSubscriptionRef = useRef<{ dispose: () => void } | null>(null)
  const onCodeChangeRef = useRef(onCodeChange)
  onCodeChangeRef.current = onCodeChange
  // LessonRenderer supplies a domain-stable lesson/block identity. The useId
  // fallback keeps standalone/test mounts isolated without retaining them.
  const reactId = useId()
  const uriHint = canonicalModel
    ? undefined
    : stableUriHint ?? `teach-code-task-${reactId.replace(/[^\w-]/g, '')}`

  // Publish the imperative read/write handle the block (and active-editor
  // registry) use. Reads/writes go straight to the live editor model so a
  // teacher `set_editor_code` lands in the visible buffer and the next run reads
  // whatever the learner currently has.
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
