/* eslint-disable react-refresh/only-export-components */
'use client'

import { createContext, use, useCallback, useMemo, useRef } from 'react'
import type * as monaco from '@codingame/monaco-vscode-editor-api'
import type { FlatSection } from '@/tour/types'
import type { ClassroomAction } from '@/lib/ai/classroom/reducer'
import type { ClassroomSession } from '@/lib/ai/classroom/types'
import type { NewChatAnnotation } from '@/lib/ai/classroom/editor-annotations'

/**
 * Thin wrapper around the Monaco editor instance ref. Reactive state lives in
 * `tourEditorStore` / `learnerStore` — this context only owns the imperative editor
 * handle that must survive parent re-renders.
 */
export interface EditorBridge {
  getEditor: () => monaco.editor.IStandaloneCodeEditor | undefined
  setEditor: (editor: monaco.editor.IStandaloneCodeEditor | undefined) => void
}

export interface TourBridgeValue {
  editor: EditorBridge
  lang: string
}

export type UILang = 'zh' | 'en'

export interface AIClassroomBridge {
  getSession: () => ClassroomSession
  dispatch: (action: ClassroomAction) => void
  replaceChatAnnotations: (annotations: NewChatAnnotation[]) => void
  clearChatAnnotations: () => void
}

export interface AIBridgeValue {
  editor: EditorBridge
  lang: string
  uiLang: UILang
  allSections: FlatSection[]
  classroom?: AIClassroomBridge
}

const TourBridgeContext = createContext<TourBridgeValue | null>(null)
const AIBridgeContext = createContext<AIBridgeValue | null>(null)

function useStableEditorBridge(): EditorBridge {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | undefined>(undefined)
  const getEditor = useCallback(() => editorRef.current, [])
  const setEditor = useCallback((ed: monaco.editor.IStandaloneCodeEditor | undefined) => {
    editorRef.current = ed
  }, [])
  return useMemo<EditorBridge>(() => ({ getEditor, setEditor }), [getEditor, setEditor])
}

// ---------------- Tour bridge (tutorial mode) ----------------

export function useTourBridge(): TourBridgeValue {
  const ctx = use(TourBridgeContext)
  if (!ctx)
    throw new Error('useTourBridge must be used within <TourBridgeProvider>')
  return ctx
}

/**
 * @deprecated Prefer `useTourBridge()` (tutorial routes) or `useAIBridge()` (AI route).
 * Retained for code paths that only need editor + lang, regardless of mode.
 */
export function useEditorBridge(): { editor: EditorBridge, lang: string } {
  const tour = use(TourBridgeContext)
  if (tour)
    return { editor: tour.editor, lang: tour.lang }
  const ai = use(AIBridgeContext)
  if (ai)
    return { editor: ai.editor, lang: ai.lang }
  throw new Error('useEditorBridge must be used within <TourBridgeProvider> or <AIBridgeProvider>')
}

interface TourProviderProps {
  children: React.ReactNode
  lang: string
}

export function TourBridgeProvider({ children, lang }: TourProviderProps) {
  const editor = useStableEditorBridge()
  const value = useMemo<TourBridgeValue>(() => ({ editor, lang }), [editor, lang])
  return (
    <TourBridgeContext value={value}>
      {children}
    </TourBridgeContext>
  )
}

// ---------------- AI bridge (autonomous tutor mode) ----------------

export function useAIBridge(): AIBridgeValue {
  const ctx = use(AIBridgeContext)
  if (!ctx)
    throw new Error('useAIBridge must be used within <AIBridgeProvider>')
  return ctx
}

interface AIProviderProps {
  children: React.ReactNode
  lang: string
  allSections: FlatSection[]
  classroom?: AIClassroomBridge
}

export function AIBridgeProvider({ children, lang, allSections, classroom }: AIProviderProps) {
  const editor = useStableEditorBridge()
  const uiLang: UILang = lang === 'en' ? 'en' : 'zh'

  const value = useMemo<AIBridgeValue>(
    () => ({ editor, lang, uiLang, allSections, classroom }),
    [editor, lang, uiLang, allSections, classroom],
  )

  return (
    <AIBridgeContext value={value}>
      {children}
    </AIBridgeContext>
  )
}
