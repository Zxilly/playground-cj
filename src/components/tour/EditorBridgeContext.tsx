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

const TourBridgeContext = createContext<TourBridgeValue | null>(null)

export function useEditorBridge(): TourBridgeValue {
  const ctx = use(TourBridgeContext)
  if (!ctx)
    throw new Error('useEditorBridge must be used within <TourBridgeProvider>')
  return ctx
}

interface ProviderProps {
  children: React.ReactNode
  lang: string
  section: FlatSection
  allSections: FlatSection[]
  navigate: (index: number) => void
  goToSection: (chapterId: string, subChapterId: string, sectionId: string) => void
}

export function TourBridgeProvider({ children, lang, section, allSections, navigate, goToSection }: ProviderProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | undefined>(undefined)
  const initialCodeRef = useRef<string>(section.code[lang] || section.code.zh || '')
  const outputRef = useRef({ compilerOutput: '', programOutput: '' })

  const editor = useMemo<EditorBridge>(() => ({
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
  }), [])

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
