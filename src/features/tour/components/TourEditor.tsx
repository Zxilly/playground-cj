'use client'

import { MonacoEditorReactComp } from '@/modules/cangjie-editor/components/EditorWrapper'
import CodeRunner from '@/modules/cangjie-editor/components/CodeRunner'
import { Toaster } from '@/components/ui/sonner'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { updateEditor } from '@/lib/monaco'
import * as monaco from '@codingame/monaco-vscode-editor-api'
import type { MonacoEditorHandle } from '@/modules/cangjie-editor/components/EditorWrapper'
import { useCallback, useEffect, useRef, useState } from 'react'
import { usePanelRef } from 'react-resizable-panels'
import { useMedia } from 'react-use'
import { useEditorBridge } from '@/modules/cangjie-editor/context/useEditorBridge'
import { useTourEditorStore } from '@/stores/tourEditor'
import { TourEditorLoading } from './TourEditorLoading'
import { TourEditorToolbar } from './TourEditorToolbar'
import { TourNativeOutput } from './TourNativeOutput'
import styles from './TourEditor.module.css'

interface TourEditorProps {
  code: string
  locale: string
  layout?: 'full' | 'editorOnly'
  enableLanguageClient?: boolean
  // Disambiguator for the Monaco model URI. When set, this TourEditor owns a
  // model that persists across React mounts (so the user's edits survive when
  // the host card unmounts and re-mounts), AND the bridge.editor registration
  // is delegated to the caller via onEditorReady — useful for surfaces like
  // the AI classroom where multiple editors live on one page.
  uriHint?: string
  readOnly?: boolean
  // When provided, the caller takes responsibility for bridge.editor registration
  // and for invoking handlers like reset/run against the supplied handle.
  // TourEditor stops touching bridge.editor.
  onEditorReady?: (handle: MonacoEditorHandle) => void
  onCursorPositionChange?: (position: { lineNumber: number, column: number }) => void
}

const TOUR_RUN_MARKER_OWNER = 'tour-run'
const EXIT_CODE_RE = /\n?-{10}\nexit code\s+-?\d+\s*$/i
const NEWLINE_RE = /\r?\n/
const LOCATION_PATTERNS = [
  /(?:^|[\s(])([^()\s]+\.cj):(\d+):(\d+)(?:[):\s]|$)/,
  / at ([^()\s]+\.cj):(\d+):(\d+)/,
]
const WARNING_RE = /\bwarning\b/i
const SEPARATOR_RE = /^-{3,}$/

interface CompilerDiagnostic {
  severity: monaco.MarkerSeverity
  message: string
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
}

function stripExitCodeFooter(output: string): string {
  return output.replace(EXIT_CODE_RE, '').trim()
}

function parseCompilerDiagnostics(output: string, model: monaco.editor.ITextModel): CompilerDiagnostic[] {
  const source = stripExitCodeFooter(output)
  if (!source)
    return []

  const lines = source.split(NEWLINE_RE)
  const diagnostics: CompilerDiagnostic[] = []

  for (let index = 0; index < lines.length; index++) {
    const lineText = lines[index].trim()
    if (!lineText)
      continue

    let locationMatch: RegExpMatchArray | null = null
    for (const pattern of LOCATION_PATTERNS) {
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

    const severity = WARNING_RE.test(lineText)
      ? monaco.MarkerSeverity.Warning
      : monaco.MarkerSeverity.Error

    const messageParts = [lineText]
    let nextIndex = index + 1
    while (nextIndex < lines.length) {
      const nextLine = lines[nextIndex].trim()
      if (!nextLine)
        break
      if (LOCATION_PATTERNS.some(pattern => pattern.test(nextLine)))
        break
      if (SEPARATOR_RE.test(nextLine))
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

export function TourEditor({
  code,
  locale,
  layout = 'full',
  enableLanguageClient = true,
  uriHint,
  readOnly = false,
  onEditorReady,
  onCursorPositionChange,
}: TourEditorProps) {
  const editorAppRef = useRef<MonacoEditorHandle | undefined>(undefined)
  const [editorReady, setEditorReady] = useState(false)
  const [running, setRunning] = useState(false)
  const [outputRevealRequest, setOutputRevealRequest] = useState(0)
  const [outputState, setOutputState] = useState({ code, expanded: false })
  if (outputState.code !== code)
    setOutputState({ code, expanded: false })
  const outputExpanded = outputState.code === code && outputState.expanded
  const isDesktop = useMedia('(min-width: 1024px)', false)
  const outputPanelRef = usePanelRef()
  const outputGroupElementRef = useRef<HTMLDivElement>(null)
  const statusBarHostRef = useRef<HTMLDivElement>(null)
  const outputToggleRef = useRef<HTMLElement>(null)
  const outputSizesRef = useRef({ desktopPercent: 32, mobilePixels: 96 })
  const outputVisible = outputExpanded
  const [outputMounted, setOutputMounted] = useState(false)
  const cursorPositionDisposableRef = useRef<{ dispose: () => void } | null>(null)
  const codeRef = useRef(code)
  const setOutputExpanded = useCallback((expanded: boolean) => {
    setOutputState({ code: codeRef.current, expanded })
    if (expanded)
      setOutputMounted(true)
  }, [])
  const bridge = useEditorBridge()
  // Caller-owned instances skip bridge registration AND skip the code-prop
  // auto-reset effect — both behaviours are surface-specific to the singleton
  // tour-page editor and would otherwise clobber per-exercise state.
  const callerOwned = onEditorReady !== undefined
  const onEditorReadyRef = useRef(onEditorReady)
  onEditorReadyRef.current = onEditorReady
  const onCursorPositionChangeRef = useRef(onCursorPositionChange)
  onCursorPositionChangeRef.current = onCursorPositionChange

  const toolOutput = useTourEditorStore(state => state.compilerOutput)
  const programOutput = useTourEditorStore(state => state.programOutput)
  const truncation = useTourEditorStore(state => state.truncation)
  const activeTab = useTourEditorStore(state => state.activeTab)
  const setActiveTab = useTourEditorStore(state => state.setActiveTab)
  const resetOutputs = useTourEditorStore(state => state.resetOutputs)
  const setInitialCode = useTourEditorStore(state => state.setInitialCode)

  useEffect(() => {
    if (layout !== 'full')
      return
    if (!outputVisible) {
      outputPanelRef.current?.collapse()
      return
    }

    const group = outputGroupElementRef.current
    if (!group)
      return

    // The outer reading/editor split also resizes at the desktop breakpoint.
    // Restore output against the group's final height, not its pre-resize size.
    // Keep mobile output compact while respecting the native panel's 77px minimum.
    const resizeOutput = () => {
      const height = group.getBoundingClientRect().height
      if (height <= 0)
        return
      const desired = isDesktop
        ? height * outputSizesRef.current.desktopPercent / 100
        : outputSizesRef.current.mobilePixels
      outputPanelRef.current?.resize(Math.max(77, Math.min(desired, height * 0.55)))
    }
    let frame: number | null = null
    const observer = new ResizeObserver(() => {
      if (frame !== null)
        return
      frame = requestAnimationFrame(() => {
        frame = null
        resizeOutput()
      })
    })
    observer.observe(group)
    resizeOutput()
    return () => {
      observer.disconnect()
      if (frame !== null)
        cancelAnimationFrame(frame)
    }
  }, [isDesktop, layout, outputPanelRef, outputVisible])

  // CodeRunner reports the actual run lifecycle for both the toolbar and Monaco
  // commands. Its callback reveals output without changing the reading toggle.
  const handleRunningChange = useCallback((next: boolean) => {
    setRunning(next)
    if (next) {
      setOutputExpanded(true)
      // A new run must reveal the native channel even if React already considers
      // the panel open (for example, after selecting the language-server log).
      setOutputRevealRequest(request => request + 1)
    }
  }, [setOutputExpanded])

  const clearCompilerMarkers = useCallback(() => {
    const model = editorAppRef.current?.getEditor()?.getModel()
    if (model)
      monaco.editor.setModelMarkers(model, TOUR_RUN_MARKER_OWNER, [])
  }, [])

  const syncCursorPosition = useCallback(() => {
    const position = editorAppRef.current?.getEditor()?.getPosition()
    if (position) {
      onCursorPositionChangeRef.current?.({
        lineNumber: position.lineNumber,
        column: position.column,
      })
    }
  }, [])

  const syncCompilerMarkers = useCallback((output: string) => {
    const model = editorAppRef.current?.getEditor()?.getModel()
    if (!model)
      return

    monaco.editor.setModelMarkers(model, TOUR_RUN_MARKER_OWNER, toMarkerData(parseCompilerDiagnostics(output, model)))
  }, [])

  useEffect(() => {
    codeRef.current = code
    // Caller-owned instances (e.g. classroom exercises) keep model state across
    // mount/unmount; auto-resetting on code prop change would erase the user's
    // edits any time the host card re-renders. They use the reset button instead.
    if (callerOwned)
      return
    setInitialCode(code)
    const editor = editorAppRef.current?.getEditor()
    const model = editor?.getModel()
    if (!model)
      return

    if (model.getValue() !== code)
      model.setValue(code)

    resetOutputs()
    clearCompilerMarkers()
  }, [callerOwned, clearCompilerMarkers, code, resetOutputs, setInitialCode])

  useEffect(() => {
    syncCompilerMarkers(toolOutput)
  }, [syncCompilerMarkers, toolOutput])

  useEffect(() => {
    return () => {
      cursorPositionDisposableRef.current?.dispose()
      cursorPositionDisposableRef.current = null
      clearCompilerMarkers()
      if (!callerOwned)
        bridge.editor.setEditor(undefined)
    }
  }, [callerOwned, clearCompilerMarkers, bridge.editor])

  // Toggle readOnly via Monaco's runtime options so changing isActive on a
  // mounted exercise card doesn't require tearing down the editor.
  useEffect(() => {
    editorAppRef.current?.getEditor()?.updateOptions({ readOnly })
  }, [readOnly])

  const onLoad = useCallback((editorApp: MonacoEditorHandle) => {
    editorAppRef.current = editorApp
    const ed = editorApp.getEditor()
    setEditorReady(Boolean(ed))
    ed?.updateOptions({ readOnly })
    cursorPositionDisposableRef.current?.dispose()
    cursorPositionDisposableRef.current = null
    if (onCursorPositionChangeRef.current) {
      syncCursorPosition()
      cursorPositionDisposableRef.current = ed?.onDidChangeCursorPosition((event) => {
        onCursorPositionChangeRef.current?.({
          lineNumber: event.position.lineNumber,
          column: event.position.column,
        })
      }) ?? null
    }
    if (onEditorReadyRef.current) {
      onEditorReadyRef.current(editorApp)
    }
    else {
      bridge.editor.setEditor(ed ?? undefined)
    }
    if (layout === 'full') {
      const store = useTourEditorStore.getState()
      updateEditor({
        setProgramOutput: store.setProgramOutput,
        setToolOutput: store.setCompilerOutput,
        ed: ed!,
      })
      syncCompilerMarkers(useTourEditorStore.getState().compilerOutput)
    }
  }, [bridge.editor, layout, readOnly, syncCompilerMarkers, syncCursorPosition])

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
      setOutputExpanded(false)
      clearCompilerMarkers()
    }
  }, [clearCompilerMarkers, resetOutputs, setOutputExpanded])

  const handleFormatted = useCallback((formattedCode: string) => {
    editorAppRef.current?.getEditor()?.getModel()?.setValue(formattedCode)
  }, [])

  if (layout === 'editorOnly') {
    return (
      <div className="relative h-full min-h-0" data-tour-editor-root>
        <MonacoEditorReactComp
          code={code}
          onLoad={onLoad}
          locale={locale}
          enableLanguageClient={enableLanguageClient}
          uriHint={uriHint}
        />
        {!editorReady && (
          <div className="absolute inset-0 z-10">
            <TourEditorLoading code={code} locale={locale} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col" data-tour-editor-root>
      <TourEditorToolbar
        locale={locale}
        ready={editorReady}
        running={running}
        outputExpanded={outputVisible}
        outputToggleRef={outputToggleRef}
        onToggleOutput={() => setOutputExpanded(!outputExpanded)}
        onRun={handleRun}
        onFormat={handleFormat}
        onReset={handleReset}
      />
      <ResizablePanelGroup
        elementRef={outputGroupElementRef}
        orientation="vertical"
        className="min-h-0 flex-1"
        onLayoutChanged={(sizes, { isUserInteraction }) => {
          if (!isUserInteraction)
            return
          const size = sizes['tour-output-panel']
          if (size > 0) {
            if (isDesktop)
              outputSizesRef.current.desktopPercent = size
            else
              outputSizesRef.current.mobilePixels = outputPanelRef.current?.getSize().inPixels ?? 96
          }
          setOutputExpanded(size > 0)
        }}
      >
        <ResizablePanel id="tour-code-panel" minSize="45%">
          <div
            className="relative h-full min-h-0"
          >
            <MonacoEditorReactComp
              code={code}
              onLoad={onLoad}
              locale={locale}
              enableLanguageClient={enableLanguageClient}
              statusBarCompactHeight={22}
              statusBarHostRef={statusBarHostRef}
            />
            {!editorReady && (
              <div className="absolute inset-0 z-10">
                <TourEditorLoading code={code} locale={locale} />
              </div>
            )}
          </div>
        </ResizablePanel>
        <ResizableHandle disabled={!outputVisible} className={outputVisible ? 'bg-(--vscode-panel-border,var(--tour-border))' : 'hidden'} />
        <ResizablePanel
          id="tour-output-panel"
          panelRef={outputPanelRef}
          defaultSize="0%"
          collapsedSize="0%"
          collapsible
          minSize="77px"
        >
          <div
            id="tour-output-content"
            hidden={!outputVisible}
            inert={!outputVisible}
            className="h-full min-h-0 overflow-hidden"
          >
            {editorReady && outputMounted && (
              <TourNativeOutput
                locale={locale}
                expanded={outputVisible}
                revealRequest={outputRevealRequest}
                activeTab={activeTab}
                onActiveTabChange={setActiveTab}
                onClose={() => {
                  setOutputExpanded(false)
                  outputToggleRef.current?.focus()
                }}
                programOutput={programOutput + (truncation.programStdout || truncation.programStderr
                  ? `\n\n${locale === 'en' ? 'Program output was truncated.' : '程序输出已截断。'}`
                  : '')}
                compilerOutput={toolOutput + (truncation.compilerOutput
                  ? `\n\n${locale === 'en' ? 'Compiler output was truncated.' : '编译器输出已截断。'}`
                  : '')}
              />
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <div id="tour-editor-statusbar" ref={statusBarHostRef} className={styles.statusBar} />

      <div className="shrink-0">
        <Toaster richColors closeButton position="top-center" />
        <CodeRunner
          setToolOutput={useTourEditorStore.getState().setCompilerOutput}
          setProgramOutput={useTourEditorStore.getState().setProgramOutput}
          setTruncation={useTourEditorStore.getState().setTruncation}
          onFormatted={handleFormatted}
          onRunningChange={handleRunningChange}
        />
      </div>
    </div>
  )
}
