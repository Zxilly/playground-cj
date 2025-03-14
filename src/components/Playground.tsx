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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMedia } from 'react-use'
import type { MonacoEditorLanguageClientWrapper } from 'monaco-editor-wrapper'
import { MonacoEditorReactComp } from '@/components/EditorWrapper'
import * as vscode from 'vscode'
import type { editor } from 'monaco-editor'
import { loadDataShareCode } from '@/service/share'
import CodeRunner from '@/components/CodeRunner'

const ansiUp = new AnsiUp()

export interface PlaygroundProps {
  defaultCode?: string
}

function Component({ defaultCode }: PlaygroundProps) {
  const [toolOutput, setToolOutput] = useState('')
  const [programOutput, setProgramOutput] = useState('')
  const [isOutputCollapsed, setIsOutputCollapsed] = useState(false)

  const wrapperRef = useRef<MonacoEditorLanguageClientWrapper | undefined>(undefined)

  const [editor, setEditor] = useState<editor.IStandaloneCodeEditor | undefined>()

  const getAction = useCallback((id: string) => {
    return editor?.getAction(id)
  }, [editor])

  const handleRun = useCallback(() => {
    getAction('cangjie.compile.run')?.run()
  }, [getAction])

  const handleFormat = useCallback(() => {
    getAction('editor.action.formatDocument')?.run()
  }, [getAction])

  const toggleOutput = useCallback(() => {
    setIsOutputCollapsed(!isOutputCollapsed)
  }, [isOutputCollapsed])

  const isMiddle = useMedia('(min-width: 768px)')

  useEffect(() => {
    if (isMiddle) {
      setIsOutputCollapsed(false)
    }
  }, [isMiddle])

  const toolOutputHtml = useMemo(() => ansiUp.ansi_to_html(toolOutput), [toolOutput])
  const programOutputHtml = useMemo(() => ansiUp.ansi_to_html(programOutput), [programOutput])

  const onLoad = useCallback((wrapper: MonacoEditorLanguageClientWrapper) => {
    wrapperRef.current = wrapper
    updateEditor({
      setProgramOutput,
      setToolOutput,
      ed: wrapper.getEditor()!,
    })
    let editor = wrapper.getEditor()!
    setEditor(editor);

    (async () => {
      try {
        await wrapper.startLanguageClients()
        vscode.window.showInformationMessage('LSP 已连接')
      }
      catch (e) {
        console.error(e)
        vscode.window.showErrorMessage('LSP 连接失败')
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
        <div className="flex-none px-2 md:px-4 pt-2 md:pt-4 flex flex-col md:flex-row justify-between items-center">
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
        <div className="flex-1 flex flex-col md:flex-row">
          <div className="flex-1 p-2 md:p-4 flex flex-col h-full w-full">
            <MonacoEditorReactComp
              wrapperConfig={wrapperConfig}
              style={{ position: 'absolute' }}
              onLoad={onLoad}
            />
          </div>
          <div className="w-full md:w-1/3 p-2 md:p-4 flex flex-col h-auto md:h-full overflow-hidden">
            <div className="md:hidden mb-2">
              <Button onClick={toggleOutput} variant="outline" className="w-full flex justify-between items-center">
                <span>
                  {isOutputCollapsed ? '显示' : '隐藏'}
                  输出内容
                </span>
                {!isOutputCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </Button>
            </div>
            <div
              className={`flex-1 overflow-hidden flex flex-col ${
                isOutputCollapsed ? 'max-h-0 opacity-0' : 'max-h-full opacity-100'
              }`}
            >
              <div className="flex flex-col pb-1 md:pb-2 flex-grow-0 flex-shrink-0 h-1/2">
                <h2 className="text-sm md:text-lg font-semibold mb-1 md:mb-2">工具输出</h2>
                <div className="border rounded font-mono text-xs md:text-sm bg-muted overflow-hidden flex-1">
                  <div className={`${isMiddle ? 'h-[calc(50vh-120px)]' : 'h-[15vh]'} overflow-y-auto overflow-x-auto p-1 md:p-2`}>
                    <pre style={{ fontFamily, margin: 0, whiteSpace: 'pre' }} dangerouslySetInnerHTML={{ __html: toolOutputHtml }} />
                  </div>
                </div>
              </div>
              <div className="flex flex-col pt-1 md:pt-2 flex-grow-0 flex-shrink-0 h-1/2">
                <h2 className="text-sm md:text-lg font-semibold mb-1 md:mb-2">程序输出</h2>
                <div className="border rounded font-mono text-xs md:text-sm bg-muted overflow-hidden flex-1">
                  <div className={`${isMiddle ? 'h-[calc(50vh-120px)]' : 'h-[15vh]'} overflow-y-auto overflow-x-auto p-1 md:p-2`}>
                    <pre style={{ fontFamily, margin: 0, whiteSpace: 'pre' }} dangerouslySetInnerHTML={{ __html: programOutputHtml }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-none p-4 pt-0 text-center text-sm text-muted-foreground">
        仓颉版本 0.58.3 |&nbsp;
        <a
          href="https://github.com/Zxilly/playground-cj"
          className="hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          在 GitHub 查看源代码
        </a>
      </div>
      <Toaster richColors position="top-center" />
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
