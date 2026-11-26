import type * as monaco from '@codingame/monaco-vscode-editor-api'
import { getStarterCode } from './starter-code'
import { fontFamily } from '@/app/font'
import type { EditorAppConfig, MonacoVscodeApiConfig } from './vscode-api'
import { configureMonacoWorkers } from './workers'
import { CANGJIE_LANGUAGE_ID, CANGJIE_LANGUAGE_NAME } from './language'
import { exerciseModelSlot, playgroundModelUri } from './model-identity'
import { DARK_COLOR_THEME, LIGHT_COLOR_THEME, resolveDocumentColorTheme } from './theme-sync'

import langConf from '@/lib/language-configuration.json'
import textMate from '@/grammars/Cangjie.tmLanguage.json'

export type { MonacoVscodeApiConfig }

export interface EditorPresentationOptions {
  /** Compact/embedded preset for narrow cards and inline exercises. */
  compact?: boolean
  wordWrap?: monaco.editor.IStandaloneEditorConstructionOptions['wordWrap']
  scrollBeyondLastLine?: boolean
  alwaysConsumeMouseWheel?: boolean
}

export function setEditorValue(ed: monaco.editor.ICodeEditor, code: string) {
  const model = ed.getModel()
  if (model) {
    model.setValue(code)
  }
}

export function createMonacoVscodeApiConfig(): MonacoVscodeApiConfig {
  return {
    $type: 'extended',
    userConfiguration: {
      json: JSON.stringify({
        'editor.wordBasedSuggestions': 'off',
        'editor.experimental.asyncTokenization': true,
        'window.autoDetectColorScheme': false,
        'workbench.colorTheme': resolveDocumentColorTheme(),
        'workbench.preferredDarkColorTheme': DARK_COLOR_THEME,
        'workbench.preferredLightColorTheme': LIGHT_COLOR_THEME,

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
export function createEditorAppConfig(
  shareCode?: string,
  locale?: string,
  uriHint?: string,
  presentation?: EditorPresentationOptions,
): EditorAppConfig {
  const defaultCode = shareCode ?? getStarterCode(locale)
  const slot = uriHint ? exerciseModelSlot(uriHint) : 'src'
  const compact = presentation?.compact ?? false

  const editorOptions: EditorAppConfig['editorOptions'] = {
    language: CANGJIE_LANGUAGE_ID,
    glyphMargin: false,
    folding: true,
    fixedOverflowWidgets: true,
  }

  const wordWrap = presentation?.wordWrap ?? (compact ? 'on' : undefined)
  if (wordWrap !== undefined)
    editorOptions.wordWrap = wordWrap

  const scrollBeyondLastLine = presentation?.scrollBeyondLastLine ?? (compact ? false : undefined)
  if (scrollBeyondLastLine !== undefined)
    editorOptions.scrollBeyondLastLine = scrollBeyondLastLine

  const alwaysConsumeMouseWheel = presentation?.alwaysConsumeMouseWheel ?? (compact ? false : undefined)
  if (alwaysConsumeMouseWheel !== undefined)
    editorOptions.scrollbar = { alwaysConsumeMouseWheel }

  if (compact)
    editorOptions.mouseWheelZoom = false

  return {
    editorOptions,
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
