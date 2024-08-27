'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { Monaco, OnMount } from '@monaco-editor/react'
import Editor from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { AnsiUp } from 'ansi_up'
import Script from 'next/script'
import { useMediaQuery } from 'usehooks-ts'
import { Button } from '@/components/ui/button'
import { setupEditor } from '@/lib/monaco'
import { SandboxStatus, remoteRun, requestRemoteAction } from '@/service/run'
import { useToast } from '@/components/ui/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { generateDataShareUrl, generateHashShareUrl, loadShareCode } from '@/service/share'
import { saveAsFile } from '@/lib/file'

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

  const { toast } = useToast()

  const editor = useCallback((monaco: Monaco) => {
    return monaco.editor.getEditors()[0]
  }, [])

  const ansiUp = useMemo(() => new AnsiUp(), [])

  const handleRun = useCallback(() => {
    if (!monacoInst)
      return

    editor(monacoInst).getAction('cangjie.compile.run')?.run()
  }, [editor, monacoInst])

  const handleFormat = useCallback(() => {
    if (!monacoInst)
      return

    editor(monacoInst)?.getAction('editor.action.formatDocument')?.run()
  }, [editor, monacoInst])

  const handleShare = useCallback(() => {
    if (!monacoInst)
      return

    editor(monacoInst).getAction('cangjie.share.hash')?.run()
  }, [editor, monacoInst])

  const toggleOutput = useCallback(() => {
    setIsOutputCollapsed(!isOutputCollapsed)
  }, [isOutputCollapsed])

  const isMiddle = useMediaQuery('(min-width: 768px)')

  useEffect(() => {
    if (isMiddle) {
      setIsOutputCollapsed(false)
    }
  }, [isMiddle])

  const onMountFunc = useCallback<OnMount>((ed, monaco) => {
    // we load shared code here to ensure it's loaded after monaco is initialized
    loadShareCode().then(([code, success]) => {
      if (success) {
        if (code) {
          ed.setValue(code)
        }
      }
      else {
        toast({
          description: '分享代码加载失败',
          variant: 'destructive',
        })
      }
    })

    monaco.languages.registerDocumentFormattingEditProvider(
      'cangjie',
      {
        async provideDocumentFormattingEdits(model: editor.ITextModel) {
          const code = model.getValue()
          const [resp, status] = await requestRemoteAction(code, 'format')

          switch (status) {
            case SandboxStatus.RATE_LIMIT:
              toast({
                description: '后端负载过大，请稍后再试',
                variant: 'destructive',
              })

              setToolOutput('后端负载过大，请稍后再试')
              return
            case SandboxStatus.UNKNOWN_ERROR:
              toast({
                description: '未知错误',
                variant: 'destructive',
              })

              setToolOutput('格式化失败')
              return
          }

          if (resp.ok) {
            toast({
              description: '格式化成功',
            })

            setToolOutput('格式化成功')
          }
          else {
            toast({
              description: '格式化失败',
              variant: 'destructive',
            })

            setToolOutput(resp.stderr)
          }

          await window.umami?.track('format')

          return [
            {
              range: model.getFullModelRange(),
              text: resp.ok ? resp.stdout : code,
            },
          ]
        },
      },
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
          setProgramOutput,
        })

        await window.umami?.track('run')
      },
    })

    ed.addAction({
      id: 'cangjie.share.url',
      label: '分享 (URL方式)',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      run: async (editor: editor.ICodeEditor) => {
        const code = editor.getValue()
        const url = generateDataShareUrl(code)

        await navigator.clipboard.writeText(url)
        toast({
          description: '已复制分享链接',
        })

        await window.umami?.track('share')
      },
    })

    ed.addAction({
      id: 'cangjie.share.hash',
      label: '分享 (Hash方式)',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      run: async (editor: editor.ICodeEditor) => {
        const code = editor.getValue()
        const url = await generateHashShareUrl(code)

        await navigator.clipboard.writeText(url)
        toast({
          description: '已复制分享链接',
        })

        await window.umami?.track('share')
      },
    })

    ed.addAction({
      id: 'cangjie.save',
      label: '保存代码',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      ],
      run: async (editor: editor.ICodeEditor) => {
        saveAsFile(editor.getValue())

        toast({
          description: '已保存代码',
        })

        await window.umami?.track('save')
      },
    })

    setMonacoInst(monaco)
  }, [toast])

  const toolOutputHtml = useMemo(() => ansiUp.ansi_to_html(toolOutput), [ansiUp, toolOutput])
  const programOutputHtml = useMemo(() => ansiUp.ansi_to_html(programOutput), [ansiUp, programOutput])

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      <div className="flex flex-col h-full overflow-hidden bg-background text-foreground p-4">
        <div className="flex-none p-2 md:p-4 flex flex-col md:flex-row justify-between items-center">
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
                minimap: { enabled: false },
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
                <span>
                  {isOutputCollapsed ? '显示' : '隐藏'}
                  输出内容
                </span>
                {!isOutputCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </Button>
            </div>
            <div
              className={`flex-1 md:flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
                isOutputCollapsed ? 'max-h-0 opacity-0' : 'max-h-[100vh] opacity-100'
              }`}
            >
              <div className="flex flex-col h-1/2 mb-2 md:mb-4">
                <h2 className="text-sm md:text-lg font-semibold mb-1 md:mb-2">工具输出</h2>
                <div className="flex-1 border rounded font-mono text-xs md:text-sm bg-muted overflow-hidden">
                  <div className="h-[15vh] md:h-full overflow-auto p-1 md:p-2">
                    <pre dangerouslySetInnerHTML={{ __html: toolOutputHtml }} />
                  </div>
                </div>
              </div>
              <div className="flex flex-col h-1/2">
                <h2 className="text-sm md:text-lg font-semibold mb-1 md:mb-2">程序输出</h2>
                <div className="flex-1 border rounded font-mono text-xs md:text-sm bg-muted overflow-hidden">
                  <div className="h-[15vh] md:h-full overflow-auto p-1 md:p-2">
                    <pre dangerouslySetInnerHTML={{ __html: programOutputHtml }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-none p-4 text-center text-sm text-muted-foreground">
        <a
          href="https://github.com/Zxilly/playground-cj"
          className="hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          在 GitHub 查看源代码
        </a>
      </div>
      <Toaster />
      <Script
        id="track"
        dangerouslySetInnerHTML={{
          __html: `
        (function () {
          var el = document.createElement('script');
          el.setAttribute('src', 'https://trail.learningman.top/script.js');
          el.setAttribute('data-website-id', '2cd9ea13-296b-4d90-998a-bbbc5613fc20');
          document.body.appendChild(el);
        })();
      `,
        }}
      />
    </div>
  )
}
