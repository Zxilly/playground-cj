'use client'

import { PlaygroundHeader } from '@/features/playground/components/PlaygroundHeader'
import { OutputPanel } from '@/features/playground/components/OutputPanel'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { updateEditor } from '@/lib/monaco'
import { isDarkMode } from '@/lib/utils'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { MonacoEditorHandle } from '@/modules/cangjie-editor/components/EditorWrapper'
import { MonacoEditorReactComp } from '@/modules/cangjie-editor/components/EditorWrapper'
import { loadDataShareCode } from '@/service/share'
import CodeRunner from '@/modules/cangjie-editor/components/CodeRunner'
import { useMedia } from 'react-use'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import type { PanelImperativeHandle } from 'react-resizable-panels'
import { Trans } from '@lingui/react/macro'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { useLanguage } from '@/hooks/useLanguage'
import { usePlaygroundStore } from '@/stores/playground'

export interface PlaygroundProps {
  defaultCode?: string
}

function Playground({ defaultCode }: PlaygroundProps) {
  const { i18n } = useLingui()
  const toolOutput = usePlaygroundStore(state => state.toolOutput)
  const programOutput = usePlaygroundStore(state => state.programOutput)
  const isOutputCollapsed = usePlaygroundStore(state => state.isOutputCollapsed)
  const toggleOutputState = usePlaygroundStore(state => state.toggleOutput)
  const setEditor = usePlaygroundStore(state => state.setEditor)
  const { locale } = useLanguage()

  const wrapperRef = useRef<MonacoEditorHandle | undefined>(undefined)

  const handleRun = useCallback(() => {
    usePlaygroundStore.getState().editor?.getAction('cangjie.compile.run')?.run()
  }, [])

  const handleFormat = useCallback(() => {
    usePlaygroundStore.getState().editor?.getAction('editor.action.formatDocument')?.run()
  }, [])

  const outputPanelRef = useRef<PanelImperativeHandle | null>(null)
  const toggleOutput = useCallback(() => {
    toggleOutputState()
    const panel = outputPanelRef.current
    if (!panel)
      return

    if (panel.isCollapsed())
      panel.expand()
    else
      panel.collapse()
  }, [toggleOutputState])

  const isDesktop = useMedia('(min-width: 1024px)')

  const onLoad = useCallback((editorApp: MonacoEditorHandle) => {
    wrapperRef.current = editorApp
    const ed = editorApp.getEditor()!
    const store = usePlaygroundStore.getState()
    updateEditor({
      setProgramOutput: store.setProgramOutput,
      setToolOutput: store.setToolOutput,
      ed,
    })
    setEditor(ed)
  }, [setEditor])

  useEffect(() => {
    return () => {
      // Drop the editor reference when the route unmounts so stale handles can't be used.
      usePlaygroundStore.getState().setEditor(undefined)
    }
  }, [])

  const handleFormatted = useCallback((code: string) => {
    usePlaygroundStore.getState().editor?.getModel()?.setValue(code)
  }, [])

  const renderedCode = useMemo(() => defaultCode ?? loadDataShareCode(), [defaultCode])

  const outputTip = isOutputCollapsed ? i18n._(msg`显示`) : i18n._(msg`隐藏`)

  return (
    <div className={`flex flex-col h-screen bg-background text-foreground ${isDarkMode() ? 'dark' : ''}`}>
      <div className="flex flex-col h-full bg-background text-foreground p-4">
        <div id="header" className="flex-none px-2 lg:px-4">
          <PlaygroundHeader
            handleRun={handleRun}
            handleFormat={handleFormat}
            wrapperRef={wrapperRef}
          />
        </div>
        <div id="main" className="flex-1 flex flex-col lg:flex-row px-2 lg:px-4 pt-1">
          <ResizablePanelGroup
            orientation={isDesktop ? 'horizontal' : 'vertical'}
            className="!overflow-visible"
          >
            <ResizablePanel defaultSize={65} className="!overflow-visible">
              <div id="editor" className="flex-1 flex flex-col h-full w-full relative border border-border">
                <MonacoEditorReactComp
                  code={renderedCode}
                  onLoad={onLoad}
                  locale={locale}
                />
              </div>
            </ResizablePanel>
            {isDesktop && <ResizableHandle withHandle className="lg:mx-4" />}
            {!isDesktop && (
              <Button
                onClick={toggleOutput}
                variant="outline"
                className="w-full flex justify-between items-center my-2"
              >
                <span>
                  <Trans>
                    {outputTip}
                    输出内容
                  </Trans>
                </span>
                {!isOutputCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </Button>
            )}
            <ResizablePanel defaultSize={35} collapsible panelRef={outputPanelRef}>
              <div id="panel" className="flex flex-col h-full overflow-hidden">
                {!isOutputCollapsed && (
                  <OutputPanel
                    toolOutput={toolOutput}
                    programOutput={programOutput}
                  />
                )}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
      <div className="flex-none p-4 pt-0 text-center text-sm text-muted-foreground">
        <Trans>
          仓颉版本 1.1.0-beta.25 | STDX 版本 1.1.0-beta.25.1 |&nbsp;
        </Trans>
        <a
          href="https://github.com/Zxilly/playground-cj"
          className="hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Trans>在 GitHub 查看源代码</Trans>
        </a>
      </div>
      <Toaster richColors closeButton position="top-center" />
      <CodeRunner
        setToolOutput={usePlaygroundStore.getState().setToolOutput}
        setProgramOutput={usePlaygroundStore.getState().setProgramOutput}
        onFormatted={handleFormatted}
      />
    </div>
  )
}

export default Playground
