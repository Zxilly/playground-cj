import type { Monaco, OnMount } from '@monaco-editor/react'
import { loader } from '@monaco-editor/react'

import { shikiToMonaco } from '@shikijs/monaco'

import type { editor } from 'monaco-editor'
import { toast } from 'sonner'
import AsyncLock from 'async-lock'
import langConf from './language-configuration.json'
import { cangjieCompletionProvider } from '@/lib/completion'
import { getHighlighter } from '@/lib/shiki'
import { SandboxStatus, remoteRun, requestRemoteAction } from '@/service/run'
import { generateDataShareUrl, generateHashShareUrl, loadShareCode } from '@/service/share'
import { defaultCode } from '@/const'
import { saveAsFile } from '@/lib/file'
import { isDarkMode } from '@/lib/utils'

loader.config({
  'paths': {
    vs: 'https://registry.npmmirror.com/monaco-editor/0.51.0/files/min/vs',
  },
  'vs/nls': {
    availableLanguages: {
      '*': 'zh-cn',
    },
  },
})

export function setupEditor(monaco: Monaco) {
  monaco.languages.register({ id: 'cangjie' })
  monaco.languages.setLanguageConfiguration('cangjie', langConf as any)

  monaco.languages.registerCompletionItemProvider('cangjie', cangjieCompletionProvider)

  ;(async () => {
    const highlighter = await getHighlighter(isDarkMode())

    shikiToMonaco(highlighter!, monaco)
  })()
}

const remoteLock = new AsyncLock()

function isBusy() {
  return remoteLock.isBusy('run')
}

interface OnMountFunctionDependencies {
  setToolOutput: (output: string) => void
  setProgramOutput: (output: string) => void
  setMonacoInst: (monaco: typeof import('monaco-editor')) => void
  addSharePictureAction: (editor: editor.ICodeEditor) => void
}

export function createOnMountFunction(deps: OnMountFunctionDependencies): OnMount {
  const {
    setToolOutput,
    setProgramOutput,
    setMonacoInst,
    addSharePictureAction,
  } = deps

  return (ed, monaco) => {
    if (window.location.hash !== '') {
      ed.setValue('分享代码加载中...')

      toast.promise(new Promise<void>((resolve, reject) => {
        remoteLock.acquire('run', async () => {
          const [code, success] = await loadShareCode()
          if (success && code) {
            setToolOutput('分享代码加载成功')
            ed.setValue(code)
            resolve()
          }
          else {
            setToolOutput('分享代码加载失败')
            ed.setValue(defaultCode)
            reject()
          }
        })
      }), {
        loading: '分享代码加载中...',
        success: '分享代码加载成功',
        error: '分享代码加载失败',
      })
    }

    monaco.languages.registerDocumentFormattingEditProvider('cangjie', {
      async provideDocumentFormattingEdits(model) {
        if (isBusy()) {
          return
        }

        let text = model.getValue()

        toast.promise(new Promise((resolve, reject) => {
          remoteLock.acquire('run', async () => {
            const [resp, status] = await requestRemoteAction(text, 'format')

            const err = (msg: string) => {
              setToolOutput(msg)
              reject(msg)
            }

            switch (status) {
              case SandboxStatus.RATE_LIMIT:
                err('后端负载过大，请稍后再试')
                return
              case SandboxStatus.UNKNOWN_ERROR:
                err('格式化失败，未知错误')
                return
            }

            if (resp.ok) {
              text = resp.stdout
              setToolOutput('格式化成功')
              resolve('格式化成功')
            }
            else {
              setToolOutput(resp.stderr)
              reject('格式化失败')
            }
          })
        }), {
          success: '格式化成功',
          error: data => data,
          loading: '正在格式化...',
        })

        // just wait the format to finish
        await remoteLock.acquire('run', () => {})

        window.umami?.track('format')

        return [
          {
            range: model.getFullModelRange(),
            text,
          },
        ]
      },
    })

    ed.addAction({
      id: 'cangjie.compile.run',
      label: '编译运行',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB],
      run: async (editor: editor.ICodeEditor) => {
        if (isBusy()) {
          return
        }

        toast.promise(async () => {
          await remoteLock.acquire('run', async () => {
            await remoteRun(editor.getValue(), {
              setToolOutput,
              setProgramOutput,
            })
          })
        }, {
          success: '运行成功',
          error: '运行失败',
          loading: '正在运行...',
        })

        window.umami?.track('run')
      },
    })

    ed.addAction({
      id: 'cangjie.share.url',
      label: '分享 (URL方式)',
      contextMenuGroupId: 'share',
      contextMenuOrder: 1.5,
      run: async (editor: editor.ICodeEditor) => {
        const code = editor.getValue()
        const url = generateDataShareUrl(code)
        await navigator.clipboard.writeText(url)
        toast.info('已复制分享链接')

        window.umami?.track('share.url')
      },
    })

    ed.addAction({
      id: 'cangjie.share.hash',
      label: '分享 (Hash方式)',
      contextMenuGroupId: 'share',
      contextMenuOrder: 1.5,
      run: async (editor: editor.ICodeEditor) => {
        const code = editor.getValue()
        const url = await generateHashShareUrl(code)
        await navigator.clipboard.writeText(url)
        toast.info('已复制分享链接')

        window.umami?.track('share.hash')
      },
    })

    addSharePictureAction(ed)

    ed.addAction({
      id: 'cangjie.save',
      label: '保存代码',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: async (editor: editor.ICodeEditor) => {
        saveAsFile(editor.getValue())
        toast.success('已保存代码')

        window.umami?.track('save')
      },
    })

    setMonacoInst(monaco)
  }
}
