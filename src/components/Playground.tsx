'use client'

import { fontFamily } from '@/app/font'
import { LanguageDropdown } from '@/components/ExamplesDropdown'
import ShareButton from '@/components/ShareButton'
import TrackingScript from '@/components/TrackingScript'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { createWrapperConfig, updateEditor } from '@/lib/monaco'
import { isDarkMode } from '@/lib/utils'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { AnsiUp } from 'ansi_up'
import { ChevronDown, ChevronUp } from 'lucide-react'
import Image from 'next/image'
import React, { useCallback, useMemo, useRef, useState } from 'react'
import type { MonacoEditorLanguageClientWrapper } from 'monaco-editor-wrapper'
import { MonacoEditorReactComp } from '@/components/EditorWrapper'
import type * as monaco from '@codingame/monaco-vscode-editor-api'
import { loadDataShareCode } from '@/service/share'
import CodeRunner from '@/components/CodeRunner'
import { useMedia } from 'react-use'
import { toast } from 'sonner'
import LabelContainer from '@/components/LabelContainer'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import type { ImperativePanelHandle } from 'react-resizable-panels'

const ansiUp = new AnsiUp()

export interface PlaygroundProps {
  defaultCode?: string
}

function Component({ defaultCode }: PlaygroundProps) {
  const [toolOutput, setToolOutput] = useState('')
  const [programOutput, setProgramOutput] = useState('')
  const [isOutputCollapsed, setIsOutputCollapsed] = useState(false)

  const wrapperRef = useRef<MonacoEditorLanguageClientWrapper | undefined>(undefined)

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

  const outputPanel = useRef<ImperativePanelHandle | null>(null)
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

  const isDesktop = useMedia('(min-width: 768px)')

  const toolOutputHtml = useMemo(() => ansiUp.ansi_to_html(toolOutput), [toolOutput])
  const programOutputHtml = useMemo(() => ansiUp.ansi_to_html(programOutput), [programOutput])

  const onLoad = useCallback((wrapper: MonacoEditorLanguageClientWrapper) => {
    wrapperRef.current = wrapper
    updateEditor({
      setProgramOutput,
      setToolOutput,
      ed: wrapper.getEditor()!,
    })
    const editor = wrapper.getEditor()!
    setEditor(editor);

    (async () => {
      try {
        await wrapper.startLanguageClients()
        toast.success('LSP 已连接')
      }
      catch (e) {
        console.error(e)
        toast.error('LSP 连接失败')
      }
    })()
  }, [])

  const renderedCode = useMemo(() => {
    if (defaultCode) {
      return defaultCode
    }
    return loadDataShareCode()
  }, [defaultCode])

  const wrapperConfig = useMemo(() => createWrapperConfig(renderedCode), [renderedCode])

  return (
    <div className={`flex flex-col h-screen overflow-hidden bg-background text-foreground ${isDarkMode() && 'dark'}`}>
      <div className="flex flex-col h-full overflow-hidden bg-background text-foreground p-4">
        <div id="header" className="flex-none px-2 md:px-4 flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center md:mb-0 mb-2">
            <Image
              src="/icon.png"
              alt="Logo"
              width={32}
              height={32}
              className="m-4"
            />
            <h1 className="text-2xl font-bold">仓颉 Playground</h1>
          </div>
          <div
            className="flex flex-col justify-between sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full md:w-auto"
          >
            <div className="w-full sm:w-[200px]">
              <LanguageDropdown action={(nxt) => {
                wrapperRef.current?.updateCodeResources({
                  modified: {
                    text: nxt,
                    enforceLanguageId: 'Cangjie',
                    uri: editor!.getModel()!.uri.toString(),
                  },
                })
              }}
              />
            </div>
            <div className="flex flex-row space-y-0 space-x-2 w-full sm:w-auto">
              <Button onClick={handleRun} className="w-full sm:w-auto">运行</Button>
              <Button onClick={handleFormat} className="w-full sm:w-auto">格式化</Button>
              <ShareButton editor={editor} />
            </div>
          </div>
        </div>
        <div id="main" className="flex-1 flex flex-col md:flex-row px-2 md:px-4 pt-2 md:pt-0">
          <ResizablePanelGroup direction={isDesktop ? 'horizontal' : 'vertical'}>
            <ResizablePanel defaultSize={65}>
              <div id="editor" className="flex-1 flex flex-col h-full w-full relative border border-gray-300 rounded-md overflow-hidden">
                <MonacoEditorReactComp
                  wrapperConfig={wrapperConfig}
                  onLoad={onLoad}
                />
              </div>
            </ResizablePanel>
            {isDesktop && <ResizableHandle withHandle className="md:mx-4" />}
            {!isDesktop && (
              <Button onClick={toggleOutput} variant="outline" className="w-full flex justify-between items-center my-2">
                <span>
                  {isOutputCollapsed ? '显示' : '隐藏'}
                  输出内容
                </span>
                {!isOutputCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </Button>
            )}
            <ResizablePanel defaultSize={35} collapsible ref={outputPanel}>
              <div id="panel" className="flex flex-col h-full overflow-hidden">
                {!isOutputCollapsed && (
                  <div
                    id="panel-content"
                    className="flex-1 overflow-hidden flex flex-col"
                  >
                    <LabelContainer
                      title="工具输出"
                      content={(
                        <pre
                          className="whitespace-pre min-h-0 min-w-0"
                          style={{ fontFamily }}
                          dangerouslySetInnerHTML={{ __html: toolOutputHtml }}
                        />
                      )}
                      className="flex-1/2 mb-1 md:mb-2"
                    />
                    <LabelContainer
                      title="程序输出"
                      content={(
                        <pre
                          className="whitespace-pre min-h-0 min-w-0"
                          style={{ fontFamily }}
                          dangerouslySetInnerHTML={{ __html: programOutputHtml }}
                        />
                      )}
                      className="flex-1/2 mt-1 md:mt-2"
                    />
                  </div>
                )}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
      <div className="flex-none p-4 pt-0 text-center text-sm text-muted-foreground">
        仓颉版本 0.60.5 | STDX 版本 0.60.5.1 |&nbsp;
        <a
          href="https://github.com/Zxilly/playground-cj"
          className="hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          在 GitHub 查看源代码
        </a>
      </div>
      <Toaster richColors closeButton position="top-center" />
      <TrackingScript />
      <SpeedInsights />
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
