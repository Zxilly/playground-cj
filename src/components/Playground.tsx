'use client'

import React, {useCallback, useMemo, useState} from 'react'
import {Button} from '@/components/ui/button'
import {ChevronDown, ChevronUp} from 'lucide-react'
import Editor, {Monaco, OnMount} from "@monaco-editor/react";
import {setupEditor} from "@/lib/monaco";
import {remoteRun, requestRemoteAction} from "@/service/run"
import type {editor} from "monaco-editor";
import {useToast} from "@/components/ui/use-toast";
import {Toaster} from "@/components/ui/toaster";
import {AnsiUp} from "ansi_up";
import {generateShareUrl, loadShareCode} from "@/service/share";

const defaultCode = `package cangjie

// 编写你的第一个仓颉程序
main(): Int64 {
    println("你好，仓颉！")
    return 0
}
`

export default function Component() {
  const [toolOutput, setToolOutput] = useState('')
  const [programOutput, setProgramOutput] = useState('')
  const [isOutputCollapsed, setIsOutputCollapsed] = useState(false)

  const [monacoInst, setMonacoInst] = useState<Monaco | null>(null)

  const {toast} = useToast()

  const editor = useCallback((monaco: Monaco) => {
    return monaco.editor.getEditors()[0]
  }, [])

  const ansiUp = useMemo(() => new AnsiUp(), [])

  const handleRun = useCallback(() => {
    if (!monacoInst) return

    editor(monacoInst).getAction("cangjie.compile.run")?.run()
  }, [editor, monacoInst])

  const handleFormat = useCallback(() => {
    if (!monacoInst) return

    editor(monacoInst)?.getAction('editor.action.formatDocument')?.run()
  }, [editor, monacoInst])

  const handleShare = useCallback(() => {
    if (!monacoInst) return

    editor(monacoInst).getAction("cangjie.share")?.run()
  }, [editor, monacoInst])

  const toggleOutput = useCallback(() => {
    setIsOutputCollapsed(!isOutputCollapsed)
  }, [isOutputCollapsed])

  const onMountFunc = useCallback<OnMount>((ed, monaco) => {
    // we load shared code here to ensure it's loaded after monaco is initialized
    loadShareCode().then((code) => {
        if (code) {
          ed.setValue(code)
        }
      }
    )

    monaco.languages.registerDocumentFormattingEditProvider(
      "cangjie",
      {
        async provideDocumentFormattingEdits(model: editor.ITextModel) {
          let code = model.getValue()
          const resp = await requestRemoteAction(code, "format")

          if (resp.ok) {
            toast({
              description: "格式化成功",
            })

            setToolOutput("格式化成功")
          } else {
            toast({
              description: "格式化失败",
              variant: "destructive",
            })

            setToolOutput(resp.stderr)
          }

          return [
            {
              range: model.getFullModelRange(),
              text: resp.ok ? resp.stdout : code
            }
          ]
        }
      }
    )

    ed.addAction({
      id: 'cangjie.compile.run',
      label: '编译运行',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB,
      ],
      run: async (editor: editor.ICodeEditor) => {
        await remoteRun(editor.getValue(), {
          setToolOutput,
          setProgramOutput
        })
      }
    })

    ed.addAction({
      id: 'cangjie.share',
      label: '分享',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      run: async (editor: editor.ICodeEditor) => {
        const code = editor.getValue()
        const url = await generateShareUrl(code)

        await navigator.clipboard.writeText(url)
        toast({
          description: "已复制分享链接",
        })
      }
    })

    setMonacoInst(monaco)
  }, [toast])

  const toolOutputHtml = useMemo(() => ansiUp.ansi_to_html(toolOutput), [ansiUp, toolOutput])
  const programOutputHtml = useMemo(() => ansiUp.ansi_to_html(programOutput), [ansiUp, programOutput])

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      <div className="flex flex-col h-full overflow-hidden bg-background text-foreground p-4">
        <div className="flex-none p-2 md:p-4 flex flex-col md:flex-row justify-between items-center">
          <h1 className="text-2xl font-bold mb-2 md:mb-0">仓颉 Playground</h1>
          <div className="flex flex-row space-y-0 space-x-2 w-full md:w-auto">
            <Button onClick={handleRun} className="w-full sm:w-auto">运行</Button>
            <Button onClick={handleFormat} className="w-full sm:w-auto">格式化</Button>
            <Button onClick={handleShare} className="w-full sm:w-auto">分享</Button>
          </div>
        </div>
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          <div className="flex-1 p-2 md:p-4 flex flex-col overflow-hidden">
            <Editor
              loading={<div>编辑器加载中...</div>}
              height="100%"
              defaultLanguage="cangjie"
              defaultValue={defaultCode}
              className="border"
              theme="vitesse-light"
              options={{
                minimap: {enabled: false},
                scrollBeyondLastLine: true,
                fontSize: 14,
              }}
              beforeMount={setupEditor}
              onMount={onMountFunc}
            />
          </div>
          <div className="w-full md:w-1/3 p-2 md:p-4 flex flex-col h-auto md:h-full">
            <div className="md:hidden mb-2">
              <Button onClick={toggleOutput} variant="outline" className="w-full flex justify-between items-center">
                <span>{isOutputCollapsed ? "显示" : "隐藏"}输出内容</span>
                {isOutputCollapsed ? <ChevronDown className="h-4 w-4"/> : <ChevronUp className="h-4 w-4"/>}
              </Button>
            </div>
            <div
              className={`flex-1 ${isOutputCollapsed ? 'hidden' : 'flex'} md:flex flex-col overflow-hidden ${isOutputCollapsed ? '' : 'h-[30vh]'} md:max-h-full transition-all duration-300`}>
              <div className="flex flex-col flex-1 min-h-0 mb-2 md:mb-4">
                <h2 className="text-sm md:text-lg font-semibold mb-1 md:mb-2">工具输出</h2>
                <div
                  className="flex-1 border rounded font-mono text-xs md:text-sm bg-muted overflow-hidden flex flex-col min-h-0">
                  <div className="flex-1 overflow-auto p-1 md:p-2 min-h-[8rem] md:min-h-0 flex flex-col">
                    <pre className="flex-1 min-h-full"
                         dangerouslySetInnerHTML={{__html: toolOutputHtml}}/>
                  </div>
                </div>
              </div>
              <div className="flex flex-col flex-1 min-h-0">
                <h2 className="text-sm md:text-lg font-semibold mb-1 md:mb-2">程序输出</h2>
                <div
                  className="flex-1 border rounded font-mono text-xs md:text-sm bg-muted overflow-hidden flex flex-col min-h-0">
                  <div className="flex-1 overflow-auto p-1 md:p-2 min-h-[8rem] md:min-h-0 flex flex-col">
                    <pre className="flex-1 min-h-full"
                         dangerouslySetInnerHTML={{__html: programOutputHtml}}/>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-none p-4 text-center text-sm text-muted-foreground">
        <a href="https://github.com/Zxilly/playground-cj" className="hover:underline" target="_blank"
           rel="noopener noreferrer">
          在 GitHub 查看源代码
        </a>
      </div>
      <Toaster/>
    </div>
  )
}
