import * as monaco from '@codingame/monaco-vscode-editor-api'
import { BrowserMessageReader, BrowserMessageWriter, CloseAction, ErrorAction } from 'vscode-languageclient/browser'
import type { LanguageClientConfig } from 'monaco-languageclient/lcwrapper'
import isMobile from 'is-mobile'
import { getLanguageClientPort } from '@/lib/lsp'

function buildLanguageConfig(): LanguageClientConfig {
  const editorPort = getLanguageClientPort()

  return {
    languageId: 'Cangjie',
    connection: {
      options: {
        $type: 'WorkerDirect',
        worker: undefined as unknown as Worker,
        messagePort: editorPort,
      },
      messageTransports: {
        reader: new BrowserMessageReader(editorPort),
        writer: new BrowserMessageWriter(editorPort),
      },
    },
    clientOptions: {
      documentSelector: ['Cangjie'],
      initializationOptions: {
        cangjiePath: '/cangjie',
        cangjieHome: '/cangjie',
        modulesHomeOption: '/cangjie',
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

export function createLanguageClientConfig(): LanguageClientConfig | undefined {
  if (isMobile({ tablet: true, featureDetect: true })) {
    return undefined
  }
  return buildLanguageConfig()
}
