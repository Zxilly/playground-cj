'use client'

import { MonacoEditorReactComp } from '@/modules/cangjie-editor/components/EditorWrapper'
import { useCodeRunner } from '@/modules/cangjie-editor/hooks/useCodeRunner'
import { Toaster } from '@/components/ui/sonner'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { registerEditorActions } from '@/lib/monaco/actions'
import { compilerMarkers } from '@/lib/monaco/compiler-markers'
import { saveAsFile } from '@/lib/file'
import { t } from '@lingui/core/macro'
import { toast } from 'sonner'
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
  sectionKey?: string
}

const TOUR_RUN_MARKER_OWNER = 'tour-run'

export function TourEditor({
  code,
  locale,
  sectionKey,
}: TourEditorProps) {
  const scopeKey = sectionKey ?? code
  const editorAppRef = useRef<MonacoEditorHandle | undefined>(undefined)
  const actionsRef = useRef<{ dispose: () => void } | null>(null)
  const [editorReady, setEditorReady] = useState(false)
  const [running, setRunning] = useState(false)
  const [outputRevealRequest, setOutputRevealRequest] = useState(0)
  const [outputState, setOutputState] = useState({ scopeKey, expanded: false })
  if (outputState.scopeKey !== scopeKey)
    setOutputState({ scopeKey, expanded: false })
  const outputExpanded = outputState.scopeKey === scopeKey && outputState.expanded
  const isDesktop = useMedia('(min-width: 1024px)', false)
  const outputPanelRef = usePanelRef()
  const outputGroupElementRef = useRef<HTMLDivElement>(null)
  const statusBarHostRef = useRef<HTMLDivElement>(null)
  const outputToggleRef = useRef<HTMLElement>(null)
  const outputSizesRef = useRef({ desktopPercent: 32, mobilePixels: 96 })
  const outputVisible = outputExpanded
  const [outputMounted, setOutputMounted] = useState(false)
  const codeRef = useRef(code)
  const scopeKeyRef = useRef(scopeKey)
  scopeKeyRef.current = scopeKey
  const setOutputExpanded = useCallback((expanded: boolean) => {
    setOutputState({ scopeKey: scopeKeyRef.current, expanded })
    if (expanded)
      setOutputMounted(true)
  }, [])
  const bridge = useEditorBridge()

  const toolOutput = useTourEditorStore(state => state.compilerOutput)
  const programOutput = useTourEditorStore(state => state.programOutput)
  const truncation = useTourEditorStore(state => state.truncation)
  const activeTab = useTourEditorStore(state => state.activeTab)
  const setActiveTab = useTourEditorStore(state => state.setActiveTab)
  const resetOutputs = useTourEditorStore(state => state.resetOutputs)
  const setInitialCode = useTourEditorStore(state => state.setInitialCode)

  useEffect(() => {
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
  }, [isDesktop, outputPanelRef, outputVisible])

  // The command hook reports the actual run lifecycle for both the toolbar and Monaco
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

  const store = useTourEditorStore.getState()
  const { run, format } = useCodeRunner({
    scopeKey,
    outputs: {
      setToolOutput: store.setCompilerOutput,
      setProgramOutput: store.setProgramOutput,
      setTruncation: store.setTruncation,
    },
    onRunningChange: handleRunningChange,
  })

  const clearCompilerMarkers = useCallback(() => {
    const model = editorAppRef.current?.getEditor()?.getModel()
    if (model)
      monaco.editor.setModelMarkers(model, TOUR_RUN_MARKER_OWNER, [])
  }, [])

  const syncCompilerMarkers = useCallback((output: string) => {
    const model = editorAppRef.current?.getEditor()?.getModel()
    if (!model)
      return

    monaco.editor.setModelMarkers(model, TOUR_RUN_MARKER_OWNER, compilerMarkers(output, model))
  }, [])

  useEffect(() => {
    codeRef.current = code
    setInitialCode(code)
    const editor = editorAppRef.current?.getEditor()
    const model = editor?.getModel()
    if (!model)
      return

    if (model.getValue() !== code)
      model.setValue(code)

    resetOutputs()
    clearCompilerMarkers()
  }, [clearCompilerMarkers, code, resetOutputs, scopeKey, setInitialCode])

  useEffect(() => {
    syncCompilerMarkers(toolOutput)
  }, [syncCompilerMarkers, toolOutput])

  useEffect(() => {
    return () => {
      actionsRef.current?.dispose()
      clearCompilerMarkers()
      bridge.editor.setEditor(undefined)
    }
  }, [clearCompilerMarkers, bridge.editor])

  const onLoad = useCallback((editorApp: MonacoEditorHandle) => {
    editorAppRef.current = editorApp
    const ed = editorApp.getEditor()
    setEditorReady(Boolean(ed))
    bridge.editor.setEditor(ed ?? undefined)
    actionsRef.current?.dispose()
    actionsRef.current = ed
      ? registerEditorActions(ed, {
          run,
          format,
          save: (source) => {
            saveAsFile(source)
            toast.success(t`已保存代码`)
          },
        })
      : null
    syncCompilerMarkers(useTourEditorStore.getState().compilerOutput)
  }, [bridge.editor, format, run, syncCompilerMarkers])

  const handleRun = useCallback(() => {
    void editorAppRef.current?.getEditor()?.getAction('cangjie.compile.run')?.run().catch(() => {})
  }, [])

  const handleFormat = useCallback(() => {
    void editorAppRef.current?.getEditor()?.getAction('editor.action.formatDocument')?.run().catch(() => {})
  }, [])

  const handleReset = useCallback(() => {
    const editor = editorAppRef.current?.getEditor()
    const model = editor?.getModel()
    if (editor && model) {
      editor.pushUndoStop()
      editor.executeEdits('tour.reset', [{ range: model.getFullModelRange(), text: codeRef.current }])
      editor.pushUndoStop()
      resetOutputs()
      setOutputExpanded(false)
      clearCompilerMarkers()
    }
  }, [clearCompilerMarkers, resetOutputs, setOutputExpanded])

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
        {/* A short mobile group must fit 60px of code, 77px of native output,
            and its separator. A 45% minimum can leave no valid expanded layout. */}
        <ResizablePanel id="tour-code-panel" minSize={isDesktop ? '45%' : '60px'}>
          <div
            className="relative h-full min-h-0"
          >
            <MonacoEditorReactComp
              code={code}
              onLoad={onLoad}
              locale={locale}
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
      </div>
    </div>
  )
}
