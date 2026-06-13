'use client'

import { useCallback, useEffect, useId, useRef } from 'react'
import { MonacoEditorReactComp } from '@/modules/cangjie-editor/components/EditorWrapper'
import type { MonacoEditorHandle } from '@/modules/cangjie-editor/components/EditorWrapper'
import { EditorBridgeProvider } from '@/modules/cangjie-editor/context/EditorBridgeProvider'
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
export function CodeTaskMonacoEditor({ initialCode, handleRef, locale }: CodeTaskEditorProps) {
  const monacoHandleRef = useRef<MonacoEditorHandle | null>(null)
  // A stable, unique model URI hint per code_task instance so multiple code
  // tasks on one page never share a Monaco model.
  const reactId = useId()
  const uriHint = `teach-code-task-${reactId.replace(/[^\w-]/g, '')}`

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
    }
    return () => {
      handleRef.current = null
    }
  }, [handleRef, initialCode])

  const onLoad = useCallback((handle: MonacoEditorHandle) => {
    monacoHandleRef.current = handle
  }, [])

  return (
    <EditorBridgeProvider lang={locale ?? 'zh'}>
      {/* The wrapper positions Monaco absolutely; give it a bounded height. */}
      <div className="relative h-64 w-full">
        <MonacoEditorReactComp
          code={initialCode}
          locale={locale}
          onLoad={onLoad}
          uriHint={uriHint}
        />
      </div>
    </EditorBridgeProvider>
  )
}
