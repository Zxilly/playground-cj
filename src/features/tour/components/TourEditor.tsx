'use client'

import { MonacoEditorReactComp } from '@/modules/cangjie-editor/components/EditorWrapper'
import { useCodeRunner } from '@/modules/cangjie-editor/hooks/useCodeRunner'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { registerEditorActions } from '@/lib/monaco/actions'
import { clearCompilerMarkers as clearModelCompilerMarkers, setCompilerMarkers } from '@/lib/monaco/compiler-markers'
import type { RunResult } from '@/lib/runner'
import { t } from '@lingui/core/macro'
import { toast } from 'sonner'
import type { MonacoEditorHandle } from '@/modules/cangjie-editor/components/EditorWrapper'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePanelRef } from 'react-resizable-panels'
import { useMedia } from 'react-use'
import { useEditorBridge } from '@/modules/cangjie-editor/context/useEditorBridge'
import { useTourEditorStore } from '@/stores/tourEditor'
import { useTourProgressStore } from '@/stores/tourProgress'
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
const DRAFT_SAVE_DEBOUNCE_MS = 300

export function TourEditor({
  code,
  locale,
  sectionKey,
}: TourEditorProps) {
  const scopeKey = sectionKey ?? code
  const editorAppRef = useRef<MonacoEditorHandle | undefined>(undefined)
  const actionsRef = useRef<{ dispose: () => void } | null>(null)
  const contentChangeRef = useRef<{ dispose: () => void } | null>(null)
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runAbortRef = useRef<AbortController | null>(null)
  const suppressDraftSaveRef = useRef(false)
  const [editorReady, setEditorReady] = useState(false)
  const [editorError, setEditorError] = useState<Error | null>(null)
  const [running, setRunning] = useState(false)
  const [runResultState, setRunResultState] = useState<{ scopeKey: string, result: RunResult | null }>({
    scopeKey,
    result: null,
  })
  const runResult = runResultState.scopeKey === scopeKey ? runResultState.result : null
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

  const initialEditorCode = useMemo(() => {
    const restored = useTourProgressStore.getState().hydrate()
    return restored.drafts[scopeKey] ?? code
  }, [code, scopeKey])

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

  const setRunResult = useCallback((result: RunResult | null) => {
    setRunResultState({ scopeKey: scopeKeyRef.current, result })
  }, [])

  const store = useTourEditorStore.getState()
  const { run, format } = useCodeRunner({
    scopeKey,
    outputs: {
      setToolOutput: store.setCompilerOutput,
      setProgramOutput: store.setProgramOutput,
      setTruncation: store.setTruncation,
      setResult: setRunResult,
    },
    onRunningChange: handleRunningChange,
  })

  const clearCompilerMarkers = useCallback(() => {
    const model = editorAppRef.current?.getEditor()?.getModel()
    if (model)
      clearModelCompilerMarkers(model, TOUR_RUN_MARKER_OWNER)
  }, [])

  const syncCompilerMarkers = useCallback((output: string) => {
    const model = editorAppRef.current?.getEditor()?.getModel()
    if (!model)
      return

    setCompilerMarkers(model, TOUR_RUN_MARKER_OWNER, output)
  }, [])

  useEffect(() => {
    codeRef.current = code
    setInitialCode(code)
    resetOutputs()
    clearCompilerMarkers()
    runAbortRef.current?.abort()
    runAbortRef.current = null

    const restored = useTourProgressStore.getState().hydrate()
    const targetCode = restored.drafts[scopeKey] ?? code

    const editor = editorAppRef.current?.getEditor()
    const model = editor?.getModel()
    if (!model)
      return

    if (model.getValue() !== targetCode) {
      suppressDraftSaveRef.current = true
      try {
        model.setValue(targetCode)
      }
      finally {
        suppressDraftSaveRef.current = false
      }
    }
  }, [clearCompilerMarkers, code, resetOutputs, scopeKey, setInitialCode])

  useEffect(() => {
    syncCompilerMarkers(toolOutput)
  }, [syncCompilerMarkers, toolOutput])

  useEffect(() => {
    return () => {
      actionsRef.current?.dispose()
      contentChangeRef.current?.dispose()
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current)
        draftSaveTimerRef.current = null
      }
      runAbortRef.current?.abort()
      clearCompilerMarkers()
      bridge.editor.setEditor(undefined)
    }
  }, [clearCompilerMarkers, bridge.editor])

  const handleCancelRun = useCallback(() => {
    runAbortRef.current?.abort(new DOMException('Cancelled by user', 'AbortError'))
  }, [])

  const onLoad = useCallback((editorApp: MonacoEditorHandle) => {
    editorAppRef.current = editorApp
    const ed = editorApp.getEditor()
    setEditorError(null)
    setEditorReady(Boolean(ed))
    bridge.editor.setEditor(ed ?? undefined)
    actionsRef.current?.dispose()
    actionsRef.current = ed
      ? registerEditorActions(ed, {
          run: async (source, signal) => {
            runAbortRef.current?.abort()
            const controller = new AbortController()
            runAbortRef.current = controller
            const combinedSignal = AbortSignal.any([signal, controller.signal])
            try {
              await run(source, combinedSignal)
            }
            catch (error) {
              if (controller.signal.aborted && !signal.aborted) {
                const cancelledText = t`已取消运行`
                useTourEditorStore.getState().setCompilerOutput(cancelledText)
                useTourEditorStore.getState().setProgramOutput('')
                toast.info(cancelledText)
                return
              }
              throw error
            }
            finally {
              if (runAbortRef.current === controller)
                runAbortRef.current = null
            }
          },
          format,
          onSave: (source) => {
            if (draftSaveTimerRef.current) {
              clearTimeout(draftSaveTimerRef.current)
              draftSaveTimerRef.current = null
            }
            useTourProgressStore.getState().saveDraft(scopeKeyRef.current, source, codeRef.current)
            toast.success(t`已保存代码`)
          },
        })
      : null

    contentChangeRef.current?.dispose()
    const model = ed?.getModel()
    if (model) {
      contentChangeRef.current = model.onDidChangeContent(() => {
        if (suppressDraftSaveRef.current)
          return
        if (draftSaveTimerRef.current)
          clearTimeout(draftSaveTimerRef.current)
        const activeKey = scopeKeyRef.current
        const starter = codeRef.current
        draftSaveTimerRef.current = setTimeout(() => {
          draftSaveTimerRef.current = null
          useTourProgressStore.getState().saveDraft(activeKey, model.getValue(), starter)
        }, DRAFT_SAVE_DEBOUNCE_MS)
      })
    }

    syncCompilerMarkers(useTourEditorStore.getState().compilerOutput)
  }, [bridge.editor, format, run, syncCompilerMarkers])

  const onError = useCallback((error: Error) => {
    setEditorError(error)
    setEditorReady(false)
  }, [])

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
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current)
        draftSaveTimerRef.current = null
      }
      suppressDraftSaveRef.current = true
      try {
        editor.pushUndoStop()
        editor.executeEdits('tour.reset', [{ range: model.getFullModelRange(), text: codeRef.current }])
        editor.pushUndoStop()
      }
      finally {
        suppressDraftSaveRef.current = false
      }
      useTourProgressStore.getState().clearDraft(scopeKeyRef.current)
      resetOutputs()
      setRunResult(null)
      setOutputExpanded(false)
      clearCompilerMarkers()
    }
  }, [clearCompilerMarkers, resetOutputs, setOutputExpanded, setRunResult])

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
        onCancelRun={running ? handleCancelRun : undefined}
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
              code={initialEditorCode}
              onLoad={onLoad}
              onError={onError}
              locale={locale}
              statusBarCompactHeight={22}
              statusBarHostRef={statusBarHostRef}
            />
            {!editorReady && !editorError && (
              <div className="absolute inset-0 z-10">
                <TourEditorLoading code={initialEditorCode} locale={locale} />
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
                running={running}
                onCancelRun={running ? handleCancelRun : undefined}
                runResult={runResult}
                programOutput={programOutput + (truncation.programStdout || truncation.programStderr
                  ? `\n\n${t`程序输出已截断。`}`
                  : '')}
                compilerOutput={toolOutput + (truncation.compilerOutput
                  ? `\n\n${t`编译器输出已截断。`}`
                  : '')}
              />
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <div id="tour-editor-statusbar" ref={statusBarHostRef} className={styles.statusBar} />
    </div>
  )
}
