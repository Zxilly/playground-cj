import type { ComponentType, RefObject } from 'react'

export interface CangjieEditorHandle {
  getCode: () => string
  setCode: (code: string) => void
  layout?: () => void
}

export interface CangjieEditorProps {
  initialCode: string
  handleRef: RefObject<CangjieEditorHandle | null>
  locale?: string
  uriHint?: string
  modelScope?: string
  fillHeight?: boolean
  canonicalModel?: boolean
  replaceCodeOnMount?: boolean
  onCodeChange?: (code: string) => void
}

export type CangjieEditorComponent = ComponentType<CangjieEditorProps>
