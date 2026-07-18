'use client'

import { createContext, use } from 'react'
import type { RefCallback, RefObject } from 'react'
import type { CodeTaskEditorHandle } from '@/features/teach/components/blocks/CodeTaskBlock'

export interface PlaygroundEditorHostContextValue {
  activateEditor: () => void
  editorHandleRef: RefObject<CodeTaskEditorHandle | null>
  registerEditorSlot: RefCallback<HTMLDivElement>
}

export const PlaygroundEditorHostContext = createContext<PlaygroundEditorHostContextValue | null>(null)

export function usePlaygroundEditorHost(): PlaygroundEditorHostContextValue {
  const context = use(PlaygroundEditorHostContext)
  if (!context)
    throw new Error('usePlaygroundEditorHost must be used inside PlaygroundEditorHost')
  return context
}
