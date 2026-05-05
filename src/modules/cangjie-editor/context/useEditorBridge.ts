'use client'

import { use } from 'react'
import { EditorBridgeContext } from '@/modules/cangjie-editor/context/editor-bridge-context'
import type { EditorBridgeValue } from '@/modules/cangjie-editor/context/editor-bridge-context'

export function useEditorBridge(): EditorBridgeValue {
  const context = use(EditorBridgeContext)
  if (!context)
    throw new Error('useEditorBridge must be used within <EditorBridgeProvider>')
  return context
}
