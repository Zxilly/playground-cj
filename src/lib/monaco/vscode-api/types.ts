import type { IExtensionManifest } from '@codingame/monaco-vscode-api/extensions'
import type * as monaco from '@codingame/monaco-vscode-editor-api'
import type { ILogger } from '@codingame/monaco-vscode-log-service-override'

export interface ExtensionConfig {
  config: IExtensionManifest
  filesOrContents?: Map<string, string | URL>
}

// Standalone editors and native output views share user configuration, workers,
// and declarative Cangjie syntax contributions.
export interface MonacoVscodeApiConfig {
  $type: 'extended'
  serviceOverrides?: monaco.editor.IEditorOverrideServices
  userConfiguration?: { json?: string }
  extensions?: ExtensionConfig[]
  monacoWorkerFactory?: (logger?: ILogger) => void
}

export interface CodeContent {
  text: string
  uri: string
  enforceLanguageId?: string
}

export interface CodeResources {
  modified?: CodeContent
}

export interface EditorAppConfig {
  overrideAutomaticLayout?: boolean
  editorOptions?: monaco.editor.IStandaloneEditorConstructionOptions & { language?: string }
  codeResources?: CodeResources
}
