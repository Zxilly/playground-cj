import '@codingame/monaco-vscode-language-pack-zh-hans'

import type { editor, languages } from 'monaco-editor'
import * as monaco from 'monaco-editor'
import { EXAMPLES, WS_BACKEND_URL } from '@/const'
import { saveAsFile } from '@/lib/file'
import { remoteRun, requestRemoteAction, SandboxStatus } from '@/service/run'
import { generateDataShareUrl, generateHashShareUrl, loadShareCode } from '@/service/share'
import AsyncLock from 'async-lock'
import { toast } from 'sonner'
import { CloseAction, ErrorAction } from 'vscode-languageclient/browser'
import type { LanguageClientConfig, WrapperConfig } from 'monaco-editor-wrapper'
import { LogLevel } from 'vscode/services'
import { useWorkerFactory } from 'monaco-editor-wrapper/workerFactory'

import '@codingame/monaco-vscode-theme-defaults-default-extension'
import getConfigurationServiceOverride from '@codingame/monaco-vscode-configuration-service-override'
import getThemeServiceOverride from '@codingame/monaco-vscode-theme-service-override'
import getTextmateServiceOverride from '@codingame/monaco-vscode-textmate-service-override'
import getKeybindingsServiceOverride from '@codingame/monaco-vscode-keybindings-service-override'
import getNotificationServiceOverride from '@codingame/monaco-vscode-notifications-service-override'
import { fontFamily } from '@/app/font'

import langConf from '@/lib/language-configuration.json'
import textMate from '@/lib/Cangjie.tmLanguage.json'
import isMobile from 'is-mobile'
import * as vscode from 'vscode'

const remoteLock = new AsyncLock()

function isBusy() {
  return remoteLock.isBusy('run')
}

interface OnMountFunctionDependencies {
  setToolOutput: (output: string) => void
  setProgramOutput: (output: string) => void
  ed: editor.IStandaloneCodeEditor
}

function loadShareCodeToEditor(ed: editor.IStandaloneCodeEditor, setToolOutput: (output: string) => void) {
  if (window.location.hash !== '') {
    ed.setValue('分享代码加载中...')

    toast.promise(new Promise<void>((resolve, reject) => {
      remoteLock.acquire('run', async () => {
        const [code, success] = await loadShareCode()
        if (success && code) {
          setToolOutput('分享代码加载成功')
          setEditorValue(ed, code)
          resolve()
        }
        else {
          setToolOutput('分享代码加载失败')
          reject()
        }
      })
    }), {
      loading: '分享代码加载中...',
      success: '分享代码加载成功',
      error: '分享代码加载失败',
    })
  }
}

function getFormatter(setToolOutput: (msg: string) => void) {
  return {
    async provideDocumentFormattingEdits(model) {
      if (isBusy()) {
        return
      }

      let text = model.getValue()

      toast.promise(new Promise((resolve, reject) => {
        const err = (msg: string) => {
          setToolOutput(msg)
          reject(msg)
        }

        remoteLock.acquire('run', async () => {
          const [resp, status] = await requestRemoteAction(text, 'format')

          switch (status) {
            case SandboxStatus.UNKNOWN_ERROR:
              err('格式化失败，未知错误')
              return
          }

          text = resp.formatted
          setToolOutput(resp.formatter_output)

          if (resp.formatter_code === 0) {
            resolve('格式化成功')
          }
          else {
            reject('格式化失败')
          }
        })
      }), {
        success: '格式化成功',
        error: data => data,
        loading: '正在格式化...',
      })

      // just wait the format to finish
      await remoteLock.acquire('run', () => {
      })

      window.umami?.track('format')

      if (text === model.getValue()) {
        return
      }

      return [
        {
          range: model.getFullModelRange(),
          text,
        },
      ]
    },
  } satisfies languages.DocumentFormattingEditProvider
}

export function setEditorValue(ed: editor.ICodeEditor, code: string) {
  const model = ed.getModel()
  if (model) {
    model.setValue(code)
  }
}

export function updateEditor(deps: OnMountFunctionDependencies) {
  const {
    setToolOutput,
    setProgramOutput,
    ed,
  } = deps

  monaco.languages.registerDocumentFormattingEditProvider('Cangjie', getFormatter(setToolOutput))

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
    label: '分享 (URL 方式)',
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
    label: '分享 (Hash 方式)',
    contextMenuGroupId: 'share',
    contextMenuOrder: 1.5,
    run: async (editor: editor.ICodeEditor) => {
      const code = editor.getValue()

      toast.promise(async () => {
        const url = await generateHashShareUrl(code)
        await navigator.clipboard.writeText(url)
      }, {
        loading: '分享中...',
        success: '分享成功，已复制分享链接',
        error: '分享失败',
      })

      window.umami?.track('share.hash')
    },
  })

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

  loadShareCodeToEditor(ed, setToolOutput)
}

function tryInitWebSocket() {
  return {
    Cangjie: {
      name: 'Cangjie Language Client',
      connection: {
        options: {
          $type: 'WebSocketUrl',
          url: WS_BACKEND_URL,
        },
      },
      clientOptions: {
        documentSelector: ['Cangjie'],
        initializationOptions: {
          multiModuleOption: {
            'file:///playground': {
              name: 'playground',
              requires: {},
            },
          },
          modulesHomeOption: '/cangjie',
          telemetryOption: true,
          conditionCompileOption: {},
          conditionCompilePaths: [],
          targetLib: '/playground/target/debug',
          singleConditionCompileOption: {},
        },
        workspaceFolder: {
          name: 'playground',
          index: 0,
          uri: (() => {
            const uri = vscode.Uri.parse('file:///playground')
            // @ts-expect-error not exposed in type
            uri._fsPath = '/playground'
            return uri
          })(),
        },
        errorHandler: {
          error: () => ({
            action: ErrorAction.Continue,
          }),
          closed: () => ({
            action: CloseAction.Restart,
          }),
        },
      },
    } satisfies LanguageClientConfig,
  }
}

export function createWrapperConfig(shareCode?: string): WrapperConfig {
  let languageClientConfigs = {}
  if (!isMobile({ tablet: true, featureDetect: true })) {
    languageClientConfigs = tryInitWebSocket()
  }

  return {
    $type: 'extended',
    htmlContainer: document.getElementById('monaco-editor-root')!,
    logLevel: LogLevel.Debug,
    languageClientConfigs,
    extensions: [
      {
        config: {
          name: 'Cangjie Extension',
          publisher: 'Zxilly',
          version: '1.0.0',
          engines: {
            vscode: '*',
          },
          contributes: {
            languages: [{
              id: 'Cangjie',
              extensions: ['.cj'],
              aliases: ['cangjie'],
              configuration: './language-configuration.json',
            }],
            grammars: [{
              language: 'Cangjie',
              scopeName: 'source.cj',
              path: './cangjie-grammar.json',
            }],
          },
        },
        filesOrContents: new Map<string, string>([
          ['./language-configuration.json', JSON.stringify(langConf)],
          ['./cangjie-grammar.json', JSON.stringify(textMate)],
        ]),
      },
    ],
    vscodeApiConfig: {
      serviceOverrides: {
        ...getThemeServiceOverride(),
        ...getTextmateServiceOverride(),
        ...getKeybindingsServiceOverride(),
        ...getConfigurationServiceOverride(),
        ...getNotificationServiceOverride(),
      },
      userConfiguration: {
        json: JSON.stringify({
          'editor.wordBasedSuggestions': 'off',
          'editor.experimental.asyncTokenization': true,
          'window.autoDetectColorScheme': true,
          'workbench.preferredDarkColorTheme': 'Default Dark Modern',
          'workbench.preferredLightColorTheme': 'Default Light Modern',

          'editor.minimap.enabled': false,
          'editor.lightbulb.enabled': 'on',
          'editor.scrollBeyondLastLine': true,
          'editor.fontSize': 14,
          'editor.fontFamily': fontFamily,
          'editor.fontLigatures': false,
          'editor.mouseWheelZoom': true,
          'editor.semanticHighlighting.enabled': true,
          'editor.cursorSmoothCaretAnimation': 'on',
        }),
      },
    },
    editorAppConfig: {
      editorOptions: {
        language: 'Cangjie',
      },
      codeResources: {
        modified: {
          text: shareCode ?? EXAMPLES['hello-world'],
          uri: 'file:///playground/src/main.cj',
        },
      },
      monacoWorkerFactory: () => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useWorkerFactory({
          workerOverrides: {
            ignoreMapping: true,
            workerLoaders: {
              TextEditorWorker: () => new Worker(new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url), { type: 'module' }),
              TextMateWorker: () => new Worker(new URL('@codingame/monaco-vscode-textmate-service-override/worker', import.meta.url), { type: 'module' }),
            },
          },
        })
      },
    },
  }
}
