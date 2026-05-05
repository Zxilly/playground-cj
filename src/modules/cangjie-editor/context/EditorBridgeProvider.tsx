'use client'

import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { EditorBridgeContext } from '@/modules/cangjie-editor/context/editor-bridge-context'
import type { EditorBridgeValue } from '@/modules/cangjie-editor/context/editor-bridge-context'
import { useStableEditorBridge } from '@/modules/cangjie-editor/hooks/useStableEditorBridge'

interface EditorBridgeProviderProps {
  children: ReactNode
  lang: string
}

export function EditorBridgeProvider({ children, lang }: EditorBridgeProviderProps) {
  const editor = useStableEditorBridge()
  const value = useMemo<EditorBridgeValue>(() => ({ editor, lang }), [editor, lang])

  return (
    <EditorBridgeContext value={value}>
      {children}
    </EditorBridgeContext>
  )
}
