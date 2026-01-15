'use client'

import { fontFamily } from '@/app/font'
import { DesktopHeader } from '@/components/DesktopHeader'
import { MobileHeader } from '@/components/MobileHeader'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { updateEditor } from '@/lib/monaco'
import { isDarkMode } from '@/lib/utils'
import { AnsiUp } from 'ansi_up'
import { ChevronDown, ChevronUp } from 'lucide-react'
import React, { useCallback, useMemo, useRef, useState } from 'react'
import type { EditorApp } from 'monaco-languageclient/editorApp'
import { MonacoEditorReactComp } from '@/components/EditorWrapper'
import type * as monaco from '@codingame/monaco-vscode-editor-api'
import { loadDataShareCode } from '@/service/share'
import CodeRunner from '@/components/CodeRunner'
import { useMedia } from 'react-use'
import LabelContainer from '@/components/LabelContainer'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import type { PanelImperativeHandle } from 'react-resizable-panels'
import { Trans } from '@lingui/react/macro'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { useLanguage } from '@/hooks/useLanguage'

const ansiUp = new AnsiUp()

export interface PlaygroundProps {
  defaultCode?: string
}

function Component({ defaultCode }: PlaygroundProps) {
  const { i18n } = useLingui()
  const [toolOutput, setToolOutput] = useState('')
  const [programOutput, setProgramOutput] = useState('')
  const [isOutputCollapsed, setIsOutputCollapsed] = useState(false)
  const { locale } = useLanguage()

  const wrapperRef = useRef<EditorApp | undefined>(undefined)

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

  const outputPanel = useRef<PanelImperativeHandle | null>(null)
  const toggleOutput = useCallback(() => {
    setIsOutputCollapsed(!isOutputCollapsed)
    if (outputPanel.current) {
      if (outputPanel.current.isCollapsed()) {
        outputPanel.current.expand()
      }
      else {
        outputPanel.current.collapse()
      }
    }
  }, [isOutputCollapsed])

  const isDesktop = useMedia('(min-width: 1024px)')

  const toolOutputHtml = useMemo(() => ansiUp.ansi_to_html(toolOutput), [toolOutput])
  const programOutputHtml = useMemo(() => ansiUp.ansi_to_html(programOutput), [programOutput])

  const onLoad = useCallback((editorApp: EditorApp) => {
    wrapperRef.current = editorApp
    updateEditor({
      setProgramOutput,
      setToolOutput,
      ed: editorApp.getEditor()!,
    })
    const editor = editorApp.getEditor()!
    setEditor(editor)
  }, [])

  const renderedCode = (() => {
    if (defaultCode) {
      return defaultCode
    }
    return loadDataShareCode()
  })()

  const outputTip = isOutputCollapsed ? i18n._(msg`显示`) : i18n._(msg`隐藏`)

  return (
    <div className={`flex flex-col h-screen bg-background text-foreground ${isDarkMode() && 'dark'}`}>
      <div className="flex flex-col h-full bg-background text-foreground p-4">
        <div id="header" className="flex-none px-2 lg:px-4">
          {isDesktop
            ? (
                <DesktopHeader
                  handleRun={handleRun}
                  handleFormat={handleFormat}
                  editor={editor}
                  wrapperRef={wrapperRef}
                />
              )
            : (
                <MobileHeader
                  handleRun={handleRun}
                  handleFormat={handleFormat}
                  editor={editor}
                  wrapperRef={wrapperRef}
                />
              )}
        </div>
        <div id="main" className="flex-1 flex flex-col lg:flex-row px-2 lg:px-4 pt-2 lg:pt-0">
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
            <ResizablePanel defaultSize={35} collapsible panelRef={outputPanel}>
              <div id="panel" className="flex flex-col h-full overflow-hidden">
                {!isOutputCollapsed && (
                  <div
                    id="panel-content"
                    className="flex-1 overflow-hidden flex flex-col"
                  >
                    <LabelContainer
                      title={i18n._(msg`工具输出`)}
                      content={(
                        <pre
                          className="whitespace-pre min-h-0 min-w-0"
                          style={{ fontFamily }}
                          dangerouslySetInnerHTML={{ __html: toolOutputHtml }}
                        />
                      )}
                      className="flex-1/2 mb-1 lg:mb-2"
                    />
                    <LabelContainer
                      title={i18n._(msg`程序输出`)}
                      content={(
                        <pre
                          className="whitespace-pre min-h-0 min-w-0"
                          style={{ fontFamily }}
                          dangerouslySetInnerHTML={{ __html: programOutputHtml }}
                        />
                      )}
                      className="flex-1/2 mt-1 lg:mt-2"
                    />
                  </div>
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
        onFormatted={(code) => {
          if (editor) {
            const model = editor.getModel()
            if (model) {
              model.setValue(code)
            }
          }
        }}
      />
    </div>
  )
}

export default Component
