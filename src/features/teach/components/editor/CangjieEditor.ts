import type { ComponentType, RefObject } from 'react'

export interface CangjieEditorHandle {
  getCode: () => string
  setCode: (code: string) => void
  layout?: () => void
  relayout?: () => void
  format?: () => Promise<void>
  setCompilerMarkers?: (output: string) => void
  clearCompilerMarkers?: () => void
}

export interface CangjieEditorProps {
  initialCode: string
  handleRef: RefObject<CangjieEditorHandle | null>
  /** Required so DynamicCangjieEditor never falls back to the wrong NLS pack. */
  locale: string
  uriHint?: string
  modelScope?: string
  fillHeight?: boolean
  compact?: boolean
  canonicalModel?: boolean
  replaceCodeOnMount?: boolean
  onCodeChange?: (code: string) => void
  onRun?: (code: string, signal: AbortSignal) => void | Promise<void>
  onSave?: (code: string, signal: AbortSignal) => void | Promise<void>
}

export type CangjieEditorComponent = ComponentType<CangjieEditorProps>
