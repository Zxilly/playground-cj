'use client'

import type { Monaco } from '@monaco-editor/react'
import { fontFamily } from '@/app/font'
import { LanguageDropdown } from '@/components/ExamplesDropdown'
import ShareButton from '@/components/ShareButton'
import TrackingScript from '@/components/TrackingScript'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { useCodeShareDialog } from '@/components/useCodeImgShare'
import { EXAMPLES } from '@/const'
import { createOnMountFunction, setupEditor } from '@/lib/monaco'
import { isDarkMode } from '@/lib/utils'
import Editor from '@monaco-editor/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { AnsiUp } from 'ansi_up'
import { ChevronDown, ChevronUp } from 'lucide-react'
import Image from 'next/image'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useMedia } from 'react-use'

const ansiUp = new AnsiUp()

export default function Component() {
  const [toolOutput, setToolOutput] = useState('')
  const [programOutput, setProgramOutput] = useState('')
  const [isOutputCollapsed, setIsOutputCollapsed] = useState(false)
  const [monacoInst, setMonacoInst] = useState<Monaco | null>(null)

  const getAction = useCallback((id: string) => {
    return monacoInst?.editor.getEditors()[0]?.getAction(id)
  }, [monacoInst?.editor])

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

  const { DialogComponent, addSharePictureAction } = useCodeShareDialog()

  const onMountFunc = useMemo(() => {
    return createOnMountFunction({
      addSharePictureAction,
      setMonacoInst,
      setProgramOutput,
      setToolOutput,
    })
  }, [addSharePictureAction])

  const toolOutputHtml = useMemo(() => ansiUp.ansi_to_html(toolOutput), [toolOutput])
  const programOutputHtml = useMemo(() => ansiUp.ansi_to_html(programOutput), [programOutput])

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
          <div className="flex flex-col justify-between sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full md:w-auto">
            <div className="w-full sm:w-[200px]">
              <LanguageDropdown action={(nxt) => {
                monacoInst?.editor.getEditors()[0]?.setValue(nxt)
              }}
              />
            </div>
            <div className="flex flex-row space-y-0 space-x-2 w-full sm:w-auto">
              <Button onClick={handleRun} className="w-full sm:w-auto">运行</Button>
              <Button onClick={handleFormat} className="w-full sm:w-auto">格式化</Button>
              <ShareButton editor={monacoInst?.editor.getEditors()[0]} />
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          <div className="flex-1 p-2 md:p-4 flex flex-col overflow-hidden">
            <Editor
              loading={<div>编辑器加载中...</div>}
              height="100%"
              defaultLanguage="cangjie"
              defaultValue={EXAMPLES['hello-world']}
              className="border"
              theme={isDarkMode() ? 'dark-plus' : 'light-plus'}
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: true,
                fontSize: 14,
                fontFamily,
                fontLigatures: false,
                mouseWheelZoom: true,
              }}
              beforeMount={setupEditor}
              onMount={onMountFunc}
            />
          </div>
          <div className="w-full md:w-1/3 p-2 md:p-4 flex flex-col h-auto md:h-full">
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
              className={`flex-1 overflow-hidden transition-all duration-300 ease-in-out ${
                isOutputCollapsed ? 'max-h-0 opacity-0' : 'max-h-[100vh] opacity-100'
              }`}
            >
              <div className="flex flex-col h-1/2 pb-1 md:pb-2">
                <h2 className="text-sm md:text-lg font-semibold mb-1 md:mb-2">工具输出</h2>
                <div className="flex-1 border rounded font-mono text-xs md:text-sm bg-muted overflow-hidden">
                  <div className={`${isMiddle ? 'h-full' : 'h-[15vh]'} overflow-auto p-1 md:p-2`}>
                    <pre style={{ fontFamily }} dangerouslySetInnerHTML={{ __html: toolOutputHtml }} />
                  </div>
                </div>
              </div>
              <div className="flex flex-col h-1/2 pt-1 md:pt-2">
                <h2 className="text-sm md:text-lg font-semibold mb-1 md:mb-2">程序输出</h2>
                <div className="flex-1 border rounded font-mono text-xs md:text-sm bg-muted overflow-hidden">
                  <div className={`${isMiddle ? 'h-full' : 'h-[15vh]'} overflow-auto p-1 md:p-2`}>
                    <pre style={{ fontFamily }} dangerouslySetInnerHTML={{ __html: programOutputHtml }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-none p-4 pt-0 text-center text-sm text-muted-foreground">
        仓颉版本 0.57.3 |&nbsp;
        <a
          href="https://github.com/Zxilly/playground-cj"
          className="hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          在 GitHub 查看源代码
        </a>
      </div>
      {DialogComponent}
      <Toaster richColors position="top-center" />
      <TrackingScript />
      <SpeedInsights />
    </div>
  )
}
