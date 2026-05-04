/* eslint-disable react-refresh/only-export-components */
'use client'

import { createContext, use, useCallback, useMemo, useRef } from 'react'
import type * as monaco from '@codingame/monaco-vscode-editor-api'
import type { FlatSection } from '@/tour/types'

export interface EditorBridge {
  getEditor: () => monaco.editor.IStandaloneCodeEditor | undefined
  setEditor: (editor: monaco.editor.IStandaloneCodeEditor | undefined) => void
  getInitialCode: () => string
  setInitialCode: (code: string) => void
  // Output observers populated by CodeRunner / TourEditor
  getLatestOutput: () => { compilerOutput: string, programOutput: string }
  setLatestOutput: (next: { compilerOutput?: string, programOutput?: string }) => void
}

export interface TourBridgeValue {
  editor: EditorBridge
  lang: string
  section: FlatSection
  allSections: FlatSection[]
  navigate: (index: number) => void
  goToSection: (chapterId: string, subChapterId: string, sectionId: string) => void
}

export type UILang = 'zh' | 'en'

export interface AIBridgeValue {
  editor: EditorBridge
  lang: string
  uiLang: UILang
  allSections: FlatSection[]
  /** Tools/UI call this after writing to the learner model so subscribers refresh. */
  notifyLearnerChange: () => void
  subscribeLearnerChange: (fn: () => void) => () => void
}

const TourBridgeContext = createContext<TourBridgeValue | null>(null)
const AIBridgeContext = createContext<AIBridgeValue | null>(null)

function createEditorBridge(initialCode: string): EditorBridge {
  const editorRef: { current: monaco.editor.IStandaloneCodeEditor | undefined } = { current: undefined }
  const initialCodeRef = { current: initialCode }
  const outputRef = { current: { compilerOutput: '', programOutput: '' } }
  return {
    getEditor: () => editorRef.current,
    setEditor: (ed) => { editorRef.current = ed },
    getInitialCode: () => initialCodeRef.current,
    setInitialCode: (code) => { initialCodeRef.current = code },
    getLatestOutput: () => outputRef.current,
    setLatestOutput: (next) => {
      const cur = outputRef.current
      const compilerOutput = next.compilerOutput ?? cur.compilerOutput
      const programOutput = next.programOutput ?? cur.programOutput
      if (compilerOutput === cur.compilerOutput && programOutput === cur.programOutput)
        return
      outputRef.current = { compilerOutput, programOutput }
    },
  }
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
  section: FlatSection
  allSections: FlatSection[]
  navigate: (index: number) => void
  goToSection: (chapterId: string, subChapterId: string, sectionId: string) => void
}

export function TourBridgeProvider({ children, lang, section, allSections, navigate, goToSection }: TourProviderProps) {
  const initialCode = section.code[lang] || section.code.zh || ''
  const editorRef = useRef<EditorBridge | null>(null)
  if (editorRef.current === null)
    editorRef.current = createEditorBridge(initialCode)
  const editor = editorRef.current

  const stableNavigate = useCallback((idx: number) => navigate(idx), [navigate])
  const stableGoToSection = useCallback(
    (c: string, s: string, sec: string) => goToSection(c, s, sec),
    [goToSection],
  )

  const value = useMemo<TourBridgeValue>(() => ({
    editor,
    lang,
    section,
    allSections,
    navigate: stableNavigate,
    goToSection: stableGoToSection,
  }), [editor, lang, section, allSections, stableNavigate, stableGoToSection])

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
  initialCode?: string
}

export function AIBridgeProvider({ children, lang, allSections, initialCode = '' }: AIProviderProps) {
  const editorRef = useRef<EditorBridge | null>(null)
  if (editorRef.current === null)
    editorRef.current = createEditorBridge(initialCode)
  const editor = editorRef.current

  const subscribersRef = useRef<Set<() => void> | null>(null)
  if (subscribersRef.current === null)
    subscribersRef.current = new Set<() => void>()

  const subscribeLearnerChange = useCallback((fn: () => void) => {
    subscribersRef.current!.add(fn)
    return () => {
      subscribersRef.current!.delete(fn)
    }
  }, [])
  const notifyLearnerChange = useCallback(() => {
    for (const fn of subscribersRef.current!) {
      try {
        fn()
      }
      catch {}
    }
  }, [])

  const uiLang: UILang = lang === 'en' ? 'en' : 'zh'

  const value = useMemo<AIBridgeValue>(() => ({
    editor,
    lang,
    uiLang,
    allSections,
    notifyLearnerChange,
    subscribeLearnerChange,
  }), [editor, lang, uiLang, allSections, notifyLearnerChange, subscribeLearnerChange])

  return (
    <AIBridgeContext value={value}>
      {children}
    </AIBridgeContext>
  )
}
