import * as monaco from '@codingame/monaco-vscode-editor-api'
import { examples, WS_BACKEND_URL } from '@/const'
import { saveAsFile } from '@/lib/file'
import { generateDataShareUrl, generateHashShareUrl, loadLegacyShareCode } from '@/service/share'
import AsyncLock from 'async-lock'
import { toast } from 'sonner'
import { CloseAction, ErrorAction } from 'vscode-languageclient/browser'
import type { LanguageClientConfig } from 'monaco-languageclient/lcwrapper'
import type { MonacoVscodeApiConfig } from 'monaco-languageclient/vscodeApiWrapper'
import type { EditorAppConfig } from 'monaco-languageclient/editorApp'
import { getEnhancedMonacoEnvironment } from 'monaco-languageclient/vscodeApiWrapper'
import { eventEmitter, EVENTS } from '@/lib/events'
import { t } from '@lingui/core/macro'

import { fontFamily } from '@/app/font'

import langConf from '@/lib/language-configuration.json'
import textMate from '@/grammars/Cangjie.tmLanguage.json'
import isMobile from 'is-mobile'

// Configure Monaco workers using new URL pattern
function configureMonacoWorkers() {
  const env = getEnhancedMonacoEnvironment()

  env.getWorker = (_workerId: string, label: string) => {
    if (label === 'editorWorkerService') {
      return new Worker(
        new URL('./editor.worker.js', import.meta.url),
        { type: 'module', name: label },
      )
    }
    if (label === 'TextMateWorker') {
      return new Worker(
        new URL('./textmate.worker.js', import.meta.url),
        { type: 'module', name: label },
      )
    }
    throw new Error(`Unknown worker label: ${label}`)
  }
}

const remoteLock = new AsyncLock()

function isBusy() {
  return remoteLock.isBusy('run')
}

interface OnMountFunctionDependencies {
  setToolOutput: (output: string) => void
  setProgramOutput: (output: string) => void
  ed: monaco.editor.IStandaloneCodeEditor
}

function loadLegacyShareCodeToEditor(ed: monaco.editor.IStandaloneCodeEditor, setToolOutput: (output: string) => void) {
  if (window.location.hash.includes('hash')) {
    ed.setValue(t`分享代码加载中...`)

    toast.promise(new Promise<void>((resolve, reject) => {
      remoteLock.acquire('run', async () => {
        const [code, success] = await loadLegacyShareCode()
        if (success && code) {
          setToolOutput(t`分享代码加载成功`)
          setEditorValue(ed, code)
          resolve()
        }
        else {
          setToolOutput(t`分享代码加载失败`)
          reject()
        }
      })
    }), {
      loading: t`分享代码加载中...`,
      success: t`分享代码加载成功`,
      error: t`分享代码加载失败`,
    })
  }
}

export function setEditorValue(ed: monaco.editor.ICodeEditor, code: string) {
  const model = ed.getModel()
  if (model) {
    model.setValue(code)
  }
}

export function updateEditor(deps: OnMountFunctionDependencies) {
  const {
    setToolOutput,
    ed,
  } = deps

  monaco.languages.registerDocumentFormattingEditProvider('Cangjie', {
    async provideDocumentFormattingEdits(model) {
      if (isBusy()) {
        return
      }

      return new Promise((resolve) => {
        const handleFormatted = (formattedCode: string) => {
          eventEmitter.off(EVENTS.FORMAT_CODE_COMPLETE, handleFormatted)
          if (formattedCode === model.getValue()) {
            resolve([])
          }
          else {
            resolve([{
              range: model.getFullModelRange(),
              text: formattedCode,
            }])
          }
        }

        eventEmitter.on(EVENTS.FORMAT_CODE_COMPLETE, handleFormatted)
        eventEmitter.emit(EVENTS.FORMAT_CODE, model.getValue())

        window.umami?.track('format')
      })
    },
  })

  ed.addAction({
    id: 'cangjie.compile.run',
    label: t`编译运行`,
    contextMenuGroupId: 'cangjie',
    contextMenuOrder: 1.5,
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB],
    run: async (editor: monaco.editor.ICodeEditor) => {
      if (isBusy()) {
        return
      }

      eventEmitter.emit(EVENTS.RUN_CODE, editor.getValue())
      window.umami?.track('run')
    },
  })

  ed.addAction({
    id: 'cangjie.share.url',
    label: t`分享 (URL 方式)`,
    contextMenuGroupId: 'cangjie',
    contextMenuOrder: 1.5,
    run: async (editor: monaco.editor.ICodeEditor) => {
      const code = editor.getValue()
      const url = generateDataShareUrl(code)
      eventEmitter.emit(EVENTS.SHOW_SHARE_DIALOG, url)
      window.umami?.track('share.url')
    },
  })

  ed.addAction({
    id: 'cangjie.share.hash',
    label: t`分享 (Hash 方式)`,
    contextMenuGroupId: 'cangjie',
    contextMenuOrder: 1.5,
    run: async (editor: monaco.editor.ICodeEditor) => {
      const code = editor.getValue()

      toast.promise(async () => {
        const url = await generateHashShareUrl(code)
        eventEmitter.emit(EVENTS.SHOW_SHARE_DIALOG, url)
      }, {
        loading: t`分享中...`,
        success: t`分享成功`,
        error: t`分享失败`,
      })

      window.umami?.track('share.hash')
    },
  })

  ed.addAction({
    id: 'cangjie.save',
    label: t`保存代码`,
    contextMenuGroupId: 'cangjie',
    contextMenuOrder: 1.5,
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
    run: async (editor: monaco.editor.ICodeEditor) => {
      saveAsFile(editor.getValue())
      toast.success(t`已保存代码`)

      window.umami?.track('save')
    },
  })

  loadLegacyShareCodeToEditor(ed, setToolOutput)
}

function buildLanguageConfig(): LanguageClientConfig {
  return {
    languageId: 'Cangjie',
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
            package_requires: {
              path_option: [
                'file:///linux_x86_64_llvm/dynamic/stdx',
              ],
            },
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
          const uri = monaco.Uri.parse('file:///playground')
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
  }
}

export type { MonacoVscodeApiConfig }

export function createMonacoVscodeApiConfig(htmlContainer?: HTMLElement): MonacoVscodeApiConfig {
  return {
    $type: 'extended',
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
        'editor.fontSize': 15,
        'editor.fontFamily': fontFamily,
        'editor.fontLigatures': false,
        'editor.mouseWheelZoom': true,
        'editor.semanticHighlighting.enabled': false,
        'editor.cursorSmoothCaretAnimation': 'on',
      }),
    },
    viewsConfig: {
      $type: 'EditorService',
      htmlContainer,
    },
    monacoWorkerFactory: configureMonacoWorkers,
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
  }
}

export function createLanguageClientConfig(): LanguageClientConfig | undefined {
  if (isMobile({ tablet: true, featureDetect: true })) {
    return undefined
  }
  return buildLanguageConfig()
}

export function createEditorAppConfig(shareCode?: string, locale?: string): EditorAppConfig {
  const helloWorldExample = examples.find(([key]) => key === 'hello-world')
  const defaultCode = shareCode ?? (locale === 'en' ? helloWorldExample?.[1].en.content : helloWorldExample?.[1].zh.content) ?? ''

  return {
    overrideAutomaticLayout: true,
    editorOptions: {
      language: 'Cangjie',
    },
    codeResources: {
      modified: {
        text: defaultCode,
        uri: 'file:///playground/src/main.cj',
      },
    },
  }
}
