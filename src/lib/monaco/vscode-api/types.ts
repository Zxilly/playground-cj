import type { IExtensionManifest } from '@codingame/monaco-vscode-api/extensions'
import type * as monaco from '@codingame/monaco-vscode-editor-api'
import type { ILogger } from '@codingame/monaco-vscode-log-service-override'
import type { ViewsServiceType } from './environment'

export type { ViewsServiceType }

export interface ViewsConfig {
  $type: ViewsServiceType
  htmlContainer?: HTMLElement
  viewsInitFunc?: () => Promise<void>
}

export interface ExtensionConfig {
  config: IExtensionManifest
  filesOrContents?: Map<string, string | URL>
}

// Trimmed to what this project uses: always `extended`, EditorService/ViewsService
// views, a user-configuration JSON blob, a worker factory, and a single
// (Cangjie) extension. classic/monarch, WorkbenchService, advanced flags are dropped.
export interface MonacoVscodeApiConfig {
  $type: 'extended'
  viewsConfig: ViewsConfig
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
