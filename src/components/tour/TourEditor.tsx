'use client'

import { MonacoEditorReactComp } from '@/components/EditorWrapper'
import CodeRunner from '@/components/CodeRunner'
import { Toaster } from '@/components/ui/sonner'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { fontFamily } from '@/app/font'
import { updateEditor } from '@/lib/monaco'
import * as monaco from '@codingame/monaco-vscode-editor-api'
import { Play, RotateCcw } from 'lucide-react'
import type { MonacoEditorHandle } from '@/components/EditorWrapper'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnsiUp } from 'ansi_up'

interface TourEditorProps {
  code: string
  locale: string
}

const TOUR_RUN_MARKER_OWNER = 'tour-run'

interface CompilerDiagnostic {
  severity: monaco.MarkerSeverity
  message: string
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
}

function createLocalizedLabels(locale: string) {
  return {
    run: locale === 'en' ? 'Run' : String.fromCodePoint(0x8FD0, 0x884C),
    format: locale === 'en' ? 'Format' : String.fromCodePoint(0x683C, 0x5F0F, 0x5316),
    reset: locale === 'en' ? 'Reset' : String.fromCodePoint(0x91CD, 0x7F6E),
    compilerOutput: locale === 'en' ? 'Compiler Output' : String.fromCodePoint(0x7F16, 0x8BD1, 0x8F93, 0x51FA),
    programOutput: locale === 'en' ? 'Program Output' : String.fromCodePoint(0x7A0B, 0x5E8F, 0x8F93, 0x51FA),
    compilerPlaceholder: locale === 'en' ? 'Run to see compiler output.' : String.fromCodePoint(0x8FD0, 0x884C, 0x540E, 0x5728, 0x6B64, 0x67E5, 0x770B, 0x7F16, 0x8BD1, 0x8F93, 0x51FA, 0x3002),
    programPlaceholder: locale === 'en' ? 'Run to see program output.' : String.fromCodePoint(0x8FD0, 0x884C, 0x540E, 0x5728, 0x6B64, 0x67E5, 0x770B, 0x7A0B, 0x5E8F, 0x8F93, 0x51FA, 0x3002),
  }
}

function stripExitCodeFooter(output: string): string {
  return output.replace(/\n?-{10}\nexit code\s+-?\d+\s*$/i, '').trim()
}

function parseCompilerDiagnostics(output: string, model: monaco.editor.ITextModel): CompilerDiagnostic[] {
  const source = stripExitCodeFooter(output)
  if (!source)
    return []

  const lines = source.split(/\r?\n/)
  const diagnostics: CompilerDiagnostic[] = []
  const locationPatterns = [
    /(?:^|[\s(])([^()\s]+\.cj):(\d+):(\d+)(?:[):\s]|$)/,
    / at ([^()\s]+\.cj):(\d+):(\d+)/,
  ]

  for (let index = 0; index < lines.length; index++) {
    const lineText = lines[index].trim()
    if (!lineText)
      continue

    let locationMatch: RegExpMatchArray | null = null
    for (const pattern of locationPatterns) {
      locationMatch = lineText.match(pattern)
      if (locationMatch)
        break
    }

    if (!locationMatch)
      continue

    const lineNumber = Number.parseInt(locationMatch[2], 10)
    const column = Number.parseInt(locationMatch[3], 10)
    if (!Number.isFinite(lineNumber) || !Number.isFinite(column))
      continue

    const safeLineNumber = Math.min(Math.max(lineNumber, 1), model.getLineCount())
    const lineMaxColumn = model.getLineMaxColumn(safeLineNumber)
    const safeColumn = Math.min(Math.max(column, 1), lineMaxColumn)

    const severity = /\bwarning\b/i.test(lineText)
      ? monaco.MarkerSeverity.Warning
      : monaco.MarkerSeverity.Error

    const messageParts = [lineText]
    let nextIndex = index + 1
    while (nextIndex < lines.length) {
      const nextLine = lines[nextIndex].trim()
      if (!nextLine)
        break
      if (locationPatterns.some(pattern => pattern.test(nextLine)))
        break
      if (/^-{3,}$/.test(nextLine))
        break
      messageParts.push(nextLine)
      nextIndex++
    }

    diagnostics.push({
      severity,
      message: messageParts.join('\n'),
      startLineNumber: safeLineNumber,
      startColumn: safeColumn,
      endLineNumber: safeLineNumber,
      endColumn: Math.min(safeColumn + 1, lineMaxColumn),
    })

    index = nextIndex - 1
  }

  return diagnostics
}

function toMarkerData(diagnostics: CompilerDiagnostic[]): monaco.editor.IMarkerData[] {
  return diagnostics.map(diagnostic => ({
    severity: diagnostic.severity,
    message: diagnostic.message,
    startLineNumber: diagnostic.startLineNumber,
    startColumn: diagnostic.startColumn,
    endLineNumber: diagnostic.endLineNumber,
    endColumn: diagnostic.endColumn,
  }))
}

export function TourEditor({ code, locale }: TourEditorProps) {
  const [toolOutput, setToolOutput] = useState('')
  const [programOutput, setProgramOutput] = useState('')
  const [activeTab, setActiveTab] = useState<'program' | 'tool'>('program')
  const editorAppRef = useRef<MonacoEditorHandle | undefined>(undefined)
  const codeRef = useRef(code)
  const ansiRef = useRef(new AnsiUp())

  const labels = useMemo(() => createLocalizedLabels(locale), [locale])
  const outputHtml = useMemo(() => {
    const ansi = ansiRef.current
    const compilerText = toolOutput || labels.compilerPlaceholder
    const runtimeText = programOutput || labels.programPlaceholder

    return activeTab === 'program'
      ? ansi.ansi_to_html(runtimeText)
      : ansi.ansi_to_html(compilerText)
  }, [activeTab, labels.compilerPlaceholder, labels.programPlaceholder, programOutput, toolOutput])

  const clearCompilerMarkers = useCallback(() => {
    const model = editorAppRef.current?.getEditor()?.getModel()
    if (model)
      monaco.editor.setModelMarkers(model, TOUR_RUN_MARKER_OWNER, [])
  }, [])

  const resetOutputs = useCallback(() => {
    setToolOutput('')
    setProgramOutput('')
  }, [])

  const syncCompilerMarkers = useCallback((output: string) => {
    const model = editorAppRef.current?.getEditor()?.getModel()
    if (!model)
      return

    monaco.editor.setModelMarkers(model, TOUR_RUN_MARKER_OWNER, toMarkerData(parseCompilerDiagnostics(output, model)))
  }, [])

  useEffect(() => {
    codeRef.current = code
    const editor = editorAppRef.current?.getEditor()
    const model = editor?.getModel()
    if (!model)
      return

    if (model.getValue() !== code) {
      model.setValue(code)
    }

    resetOutputs()
    clearCompilerMarkers()
    setActiveTab('program')
  }, [clearCompilerMarkers, code, resetOutputs])

  useEffect(() => {
    if (programOutput) {
      setActiveTab('program')
      return
    }

    if (toolOutput)
      setActiveTab('tool')
  }, [programOutput, toolOutput])

  useEffect(() => {
    syncCompilerMarkers(toolOutput)
  }, [syncCompilerMarkers, toolOutput])

  useEffect(() => {
    return () => {
      clearCompilerMarkers()
    }
  }, [clearCompilerMarkers])

  const onLoad = useCallback((editorApp: MonacoEditorHandle) => {
    editorAppRef.current = editorApp
    updateEditor({
      setProgramOutput,
      setToolOutput,
      ed: editorApp.getEditor()!,
    })
    syncCompilerMarkers(toolOutput)
  }, [syncCompilerMarkers, toolOutput])

  const handleRun = useCallback(() => {
    editorAppRef.current?.getEditor()?.getAction('cangjie.compile.run')?.run()
  }, [])

  const handleFormat = useCallback(() => {
    editorAppRef.current?.getEditor()?.getAction('editor.action.formatDocument')?.run()
  }, [])

  const handleReset = useCallback(() => {
    const editor = editorAppRef.current?.getEditor()
    if (editor) {
      editor.getModel()?.setValue(codeRef.current)
      resetOutputs()
      clearCompilerMarkers()
    }
  }, [clearCompilerMarkers, resetOutputs])

  const handleFormatted = useCallback((formattedCode: string) => {
    editorAppRef.current?.getEditor()?.getModel()?.setValue(formattedCode)
  }, [])

  return (
    <div className="flex h-full flex-col">
      <ResizablePanelGroup orientation="vertical" className="h-full">
        <ResizablePanel defaultSize={68} minSize={35}>
          <div className="relative h-full min-h-0 border-b border-border">
            <MonacoEditorReactComp
              code={code}
              onLoad={onLoad}
              locale={locale}
            />
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle className="bg-border/80" />
        <ResizablePanel defaultSize={32} minSize={18}>
          <div className="flex h-full min-h-0 flex-col bg-muted/20">
            <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-3 py-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRun}
                  data-tour-highlight="run"
                  className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-tour-teal to-tour-teal-light px-3.5 py-1.5 text-xs font-medium text-white shadow-sm shadow-tour-teal/20 transition-all hover:from-tour-teal-hover hover:to-tour-teal"
                >
                  <Play className="size-3" />
                  {labels.run}
                </button>
                <button
                  onClick={handleFormat}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {labels.format}
                </button>
                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <RotateCcw className="size-3" />
                  {labels.reset}
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={() => setActiveTab('program')}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${activeTab === 'program' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
                >
                  {labels.programOutput}
                </button>
                <button
                  onClick={() => setActiveTab('tool')}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${activeTab === 'tool' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
                >
                  {labels.compilerOutput}
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-3 py-2">
              <pre
                className="whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground"
                style={{ fontFamily }}
                dangerouslySetInnerHTML={{ __html: outputHtml }}
              />
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <div className="shrink-0">
        <Toaster richColors closeButton position="top-center" />
        <CodeRunner
          setToolOutput={setToolOutput}
          setProgramOutput={setProgramOutput}
          onFormatted={handleFormatted}
        />
      </div>
    </div>
  )
}
