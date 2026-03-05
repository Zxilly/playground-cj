import type * as monaco from '@codingame/monaco-vscode-editor-api'
import { getStatusBarServiceOverrides } from '@/lib/statusbar'
import { examples } from '@/const'
import { fontFamily } from '@/app/font'
import type { MonacoVscodeApiConfig } from 'monaco-languageclient/vscodeApiWrapper'
import type { EditorAppConfig } from 'monaco-languageclient/editorApp'
import { configureMonacoWorkers } from './workers'

import langConf from '@/lib/language-configuration.json'
import textMate from '@/grammars/Cangjie.tmLanguage.json'

export type { MonacoVscodeApiConfig }

export function setEditorValue(ed: monaco.editor.ICodeEditor, code: string) {
  const model = ed.getModel()
  if (model) {
    model.setValue(code)
  }
}

export function createMonacoVscodeApiConfig(htmlContainer?: HTMLElement): MonacoVscodeApiConfig {
  return {
    $type: 'extended',
    serviceOverrides: getStatusBarServiceOverrides(),
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

export function createEditorAppConfig(shareCode?: string, locale?: string): EditorAppConfig {
  const helloWorldExample = examples.find(([key]) => key === 'hello-world')?.[1]
  const localizedContent = locale === 'en' ? helloWorldExample?.en.content : helloWorldExample?.zh.content
  const defaultCode = shareCode ?? localizedContent ?? ''

  return {
    overrideAutomaticLayout: true,
    editorOptions: {
      language: 'Cangjie',
      glyphMargin: false,
      folding: true,
    },
    codeResources: {
      modified: {
        text: defaultCode,
        uri: 'file:///playground/src/main.cj',
      },
    },
  }
}
