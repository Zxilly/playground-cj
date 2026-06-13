import type * as monaco from '@codingame/monaco-vscode-editor-api'
import { getStatusBarServiceOverrides } from '@/lib/statusbar'
import { examples } from '@/const'
import { fontFamily } from '@/app/font'
import type { MonacoVscodeApiConfig } from 'monaco-languageclient/vscodeApiWrapper'
import type { EditorAppConfig } from 'monaco-languageclient/editorApp'
import { configureMonacoWorkers } from './workers'
import { initializeMonacoViewsService } from './views'
import { CANGJIE_LANGUAGE_ID, CANGJIE_LANGUAGE_NAME } from './language'
import { exerciseModelSlot, playgroundModelUri } from './model-identity'

import langConf from '@/lib/language-configuration.json'
import textMate from '@/grammars/Cangjie.tmLanguage.json'

export type { MonacoVscodeApiConfig }
export type MonacoViewsType = 'EditorService' | 'ViewsService'

export function setEditorValue(ed: monaco.editor.ICodeEditor, code: string) {
  const model = ed.getModel()
  if (model) {
    model.setValue(code)
  }
}

export function createMonacoVscodeApiConfig(
  htmlContainer?: HTMLElement,
  viewsType: MonacoViewsType = 'EditorService',
): MonacoVscodeApiConfig {
  const serviceOverrides = viewsType === 'EditorService'
    ? getStatusBarServiceOverrides()
    : {}

  return {
    $type: 'extended',
    serviceOverrides,
    userConfiguration: {
      json: JSON.stringify({
        'editor.wordBasedSuggestions': 'off',
        'editor.experimental.asyncTokenization': false,
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
        'editor.semanticHighlighting.enabled': true,
        'editor.cursorSmoothCaretAnimation': 'on',
      }),
    },
    viewsConfig: {
      $type: viewsType,
      htmlContainer,
      ...(viewsType === 'ViewsService'
        ? {
            viewsInitFunc: initializeMonacoViewsService,
          }
        : {}),
    },
    monacoWorkerFactory: configureMonacoWorkers,
    extensions: [
      {
        config: {
          name: 'cangjie',
          displayName: 'Cangjie Extension',
          publisher: 'zxilly',
          version: '1.0.0',
          engines: {
            vscode: '*',
          },
          browser: './extension.js',
          contributes: {
            languages: [{
              id: CANGJIE_LANGUAGE_ID,
              extensions: ['.cj'],
              aliases: [CANGJIE_LANGUAGE_NAME, CANGJIE_LANGUAGE_ID],
              configuration: './language-configuration.json',
            }],
            grammars: [{
              language: CANGJIE_LANGUAGE_ID,
              scopeName: 'source.cj',
              path: './cangjie-grammar.json',
            }],
          },
        },
        filesOrContents: new Map<string, string>([
          ['./extension.js', '// Cangjie syntax extension'],
          ['./language-configuration.json', JSON.stringify(langConf)],
          ['./cangjie-grammar.json', JSON.stringify(textMate)],
        ]),
      },
    ],
  }
}

// uriHint disambiguates editors that need to live side-by-side (one per exercise,
// for example) so each gets its own persistent Monaco model. Same hint → same
// model (preserved across React mounts); different hints → different models.
export function createEditorAppConfig(shareCode?: string, locale?: string, uriHint?: string): EditorAppConfig {
  const helloWorldExample = examples.find(([key]) => key === 'hello-world')?.[1]
  const localizedContent = locale === 'en' ? helloWorldExample?.en.content : helloWorldExample?.zh.content
  const defaultCode = shareCode ?? localizedContent ?? ''
  const slot = uriHint ? exerciseModelSlot(uriHint) : 'src'

  return {
    overrideAutomaticLayout: true,
    editorOptions: {
      language: CANGJIE_LANGUAGE_ID,
      glyphMargin: false,
      folding: true,
    },
    codeResources: {
      modified: {
        text: defaultCode,
        enforceLanguageId: CANGJIE_LANGUAGE_ID,
        uri: playgroundModelUri(slot),
      },
    },
  }
}

import.meta.webpackHot?.accept()
