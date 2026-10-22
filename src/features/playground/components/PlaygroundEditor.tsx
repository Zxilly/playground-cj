'use client'

import { use, useCallback, useMemo } from 'react'
import { MonacoEditorReactComp } from '@/modules/cangjie-editor/components/EditorWrapper'
import type { MonacoEditorHandle, MonacoEditorProps } from '@/modules/cangjie-editor/components/EditorWrapper'
import { updateEditor } from '@/lib/monaco/actions'
import { loadDataShareCode } from '@/service/share'
import { usePlaygroundStore } from '@/stores/playground'
import CodeRunner from '@/modules/cangjie-editor/components/CodeRunner'

interface PlaygroundEditorProps extends MonacoEditorProps {
  sharedCode?: Promise<string | undefined>
}

export default function PlaygroundEditor({ sharedCode, onLoad, ...props }: PlaygroundEditorProps) {
  const code = sharedCode ? use(sharedCode) : props.code
  // URL fragments are unavailable on the server. Read them within the browser-only
  // editor boundary so the shared source seeds the model on its first creation.
  const renderedCode = useMemo(() => code ?? loadDataShareCode(), [code])
  const handleLoad = useCallback((editorApp: MonacoEditorHandle) => {
    const store = usePlaygroundStore.getState()
    updateEditor({
      setProgramOutput: store.setProgramOutput,
      setToolOutput: store.setToolOutput,
      ed: editorApp.getEditor()!,
    })
    onLoad?.(editorApp)
  }, [onLoad])

  const handleFormatted = useCallback((formatted: string) => {
    usePlaygroundStore.getState().editor?.getModel()?.setValue(formatted)
  }, [])

  return (
    <>
      <MonacoEditorReactComp {...props} code={renderedCode} onLoad={handleLoad} />
      <CodeRunner
        setToolOutput={usePlaygroundStore.getState().setToolOutput}
        setProgramOutput={usePlaygroundStore.getState().setProgramOutput}
        setTruncation={usePlaygroundStore.getState().setTruncation}
        onFormatted={handleFormatted}
      />
    </>
  )
}
