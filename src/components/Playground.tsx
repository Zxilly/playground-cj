'use client'

import { PlaygroundHeader } from '@/components/playground/PlaygroundHeader'
import { OutputPanel } from '@/components/shared/OutputPanel'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { updateEditor } from '@/lib/monaco'
import { isDarkMode } from '@/lib/utils'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import type { MonacoEditorHandle } from '@/components/EditorWrapper'
import { MonacoEditorReactComp } from '@/components/EditorWrapper'
import type * as monaco from '@codingame/monaco-vscode-editor-api'
import { loadDataShareCode } from '@/service/share'
import CodeRunner from '@/components/CodeRunner'
import { useMedia } from 'react-use'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import type { PanelImperativeHandle } from 'react-resizable-panels'
import { Trans } from '@lingui/react/macro'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { useLanguage } from '@/hooks/useLanguage'

export interface PlaygroundProps {
  defaultCode?: string
}

function Playground({ defaultCode }: PlaygroundProps) {
  const { i18n } = useLingui()
  const [toolOutput, setToolOutput] = useState('')
  const [programOutput, setProgramOutput] = useState('')
  const [isOutputCollapsed, setIsOutputCollapsed] = useState(false)
  const { locale } = useLanguage()

  const wrapperRef = useRef<MonacoEditorHandle | undefined>(undefined)

  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor | undefined>()

  const getAction = useCallback((id: string) => {
    return editor?.getAction(id)
  }, [editor])

  const handleRun = useCallback(() => {
    getAction('cangjie.compile.run')?.run()
  }, [getAction])

  const handleFormat = useCallback(() => {
    getAction('editor.action.formatDocument')?.run()
  }, [getAction])

  const outputPanelRef = useRef<PanelImperativeHandle | null>(null)
  const toggleOutput = useCallback(() => {
    setIsOutputCollapsed(prev => !prev)
    const panel = outputPanelRef.current
    if (!panel)
      return

    if (panel.isCollapsed()) {
      panel.expand()
    }
    else {
      panel.collapse()
    }
  }, [])

  const isDesktop = useMedia('(min-width: 1024px)')

  const onLoad = useCallback((editorApp: MonacoEditorHandle) => {
    wrapperRef.current = editorApp
    updateEditor({
      setProgramOutput,
      setToolOutput,
      ed: editorApp.getEditor()!,
    })
    const editor = editorApp.getEditor()!
    setEditor(editor)
  }, [])

  const handleFormatted = useCallback((code: string) => {
    editor?.getModel()?.setValue(code)
  }, [editor])

  const renderedCode = useMemo(() => defaultCode ?? loadDataShareCode(), [defaultCode])

  const outputTip = isOutputCollapsed ? i18n._(msg`显示`) : i18n._(msg`隐藏`)

  return (
    <div className={`flex flex-col h-screen bg-background text-foreground ${isDarkMode() ? 'dark' : ''}`}>
      <div className="flex flex-col h-full bg-background text-foreground p-4">
        <div id="header" className="flex-none px-2 lg:px-4">
          <PlaygroundHeader
            handleRun={handleRun}
            handleFormat={handleFormat}
            editor={editor}
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
          仓颉版本 1.0.0 | STDX 版本 1.0.0.1 |&nbsp;
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
        setToolOutput={setToolOutput}
        setProgramOutput={setProgramOutput}
        onFormatted={handleFormatted}
      />
    </div>
  )
}

export default Playground
