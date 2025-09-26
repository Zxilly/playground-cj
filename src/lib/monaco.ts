import '@codingame/monaco-vscode-language-pack-zh-hans'
import * as monaco from '@codingame/monaco-vscode-editor-api'
import { EXAMPLES, WS_BACKEND_URL, EXAMPLE_CONTENT_ZH, EXAMPLE_CONTENT_EN } from '@/const'
import { saveAsFile } from '@/lib/file'
import { generateDataShareUrl, generateHashShareUrl, loadLegacyShareCode } from '@/service/share'
import AsyncLock from 'async-lock'
import { toast } from 'sonner'
import { CloseAction, ErrorAction } from 'vscode-languageclient/browser'
import type { LanguageClientConfig } from 'monaco-languageclient/lcwrapper'
import type { MonacoVscodeApiConfig } from 'monaco-languageclient/vscodeApiWrapper'
import type { EditorAppConfig } from 'monaco-languageclient/editorApp'
import { configureDefaultWorkerFactory } from 'monaco-languageclient/workerFactory'
import { eventEmitter, EVENTS } from '@/lib/events'
import { i18n } from '@/lib/i18n'
import { t } from '@lingui/core/macro'

import { fontFamily } from '@/app/font'

import langConf from '@/lib/language-configuration.json'
import textMate from '@/grammars/Cangjie.tmLanguage.json'
import isMobile from 'is-mobile'

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
    ed.setValue(i18n._(t`分享代码加载中...`))

    toast.promise(new Promise<void>((resolve, reject) => {
      remoteLock.acquire('run', async () => {
        const [code, success] = await loadLegacyShareCode()
        if (success && code) {
          setToolOutput(i18n._(t`分享代码加载成功`))
          setEditorValue(ed, code)
          resolve()
        }
        else {
          setToolOutput(i18n._(t`分享代码加载失败`))
          reject()
        }
      })
    }), {
      loading: i18n._(t`分享代码加载中...`),
      success: i18n._(t`分享代码加载成功`),
      error: i18n._(t`分享代码加载失败`),
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
    label: i18n._(t`编译运行`),
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
    label: i18n._(t`分享 (URL 方式)`),
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
    label: i18n._(t`分享 (Hash 方式)`),
    contextMenuGroupId: 'cangjie',
    contextMenuOrder: 1.5,
    run: async (editor: monaco.editor.ICodeEditor) => {
      const code = editor.getValue()

      toast.promise(async () => {
        const url = await generateHashShareUrl(code)
        eventEmitter.emit(EVENTS.SHOW_SHARE_DIALOG, url)
      }, {
        loading: i18n._(t`分享中...`),
        success: i18n._(t`分享成功`),
        error: i18n._(t`分享失败`),
      })

      window.umami?.track('share.hash')
    },
  })

  ed.addAction({
    id: 'cangjie.save',
    label: i18n._(t`保存代码`),
    contextMenuGroupId: 'cangjie',
    contextMenuOrder: 1.5,
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
    run: async (editor: monaco.editor.ICodeEditor) => {
      saveAsFile(editor.getValue())
      toast.success(i18n._(t`已保存代码`))

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

export function createMonacoVscodeApiConfig(): MonacoVscodeApiConfig {
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
        'editor.fontSize': 16,
        'editor.fontFamily': fontFamily,
        'editor.fontLigatures': false,
        'editor.mouseWheelZoom': true,
        'editor.semanticHighlighting.enabled': false,
        'editor.cursorSmoothCaretAnimation': 'on',
      }),
    },
    viewsConfig: {
      $type: 'EditorService',
      htmlContainer: 'ReactPlaceholder',
    },
    monacoWorkerFactory: configureDefaultWorkerFactory,
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
  const exampleContent = locale === 'en' ? EXAMPLE_CONTENT_EN : EXAMPLE_CONTENT_ZH
  const defaultCode = shareCode ?? exampleContent['hello-world']

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
