import * as monaco from '@codingame/monaco-vscode-editor-api'
import { MonacoLanguageClient } from 'monaco-languageclient'
import { BrowserMessageReader, BrowserMessageWriter, CloseAction, ErrorAction } from 'vscode-languageclient/browser'
import type { OutputChannel } from 'vscode'
import isMobile from 'is-mobile'

// A single Output Channel shared across every LanguageClient instance.
// When clientOptions.outputChannel is set, vscode-languageclient treats it
// as caller-owned and skips disposing it (see _disposeOutputChannel) —
// which eliminates the doCreateOutputChannel / store-disposed race that
// otherwise fires on every LSP restart and leaks a channel each time.
let sharedOutputChannel: OutputChannel | null = null
let sharedOutputChannelPromise: Promise<OutputChannel> | null = null

async function getSharedOutputChannel(): Promise<OutputChannel> {
  if (sharedOutputChannel)
    return sharedOutputChannel
  if (!sharedOutputChannelPromise) {
    sharedOutputChannelPromise = import('@codingame/monaco-vscode-extension-api')
      .then(({ window }) => {
        sharedOutputChannel = window.createOutputChannel('Cangjie') as unknown as OutputChannel
        return sharedOutputChannel
      })
      .finally(() => {
        sharedOutputChannelPromise = null
      })
  }
  return sharedOutputChannelPromise
}

function buildWorkspaceFolder() {
  const uri = monaco.Uri.parse('file:///playground')
  // @ts-expect-error not exposed in type
  uri._fsPath = '/playground'
  return { name: 'playground', index: 0, uri }
}

/**
 * Construct a MonacoLanguageClient bound to the given editor-side MessagePort.
 * Caller owns lifecycle: call `.start()` then `.stop()` / `.dispose()` when done.
 *
 * Returns `undefined` on mobile (LSP is disabled there).
 */
export async function createLanguageClient(port: MessagePort): Promise<MonacoLanguageClient | undefined> {
  if (isMobile({ tablet: true, featureDetect: true }))
    return undefined

  const outputChannel = await getSharedOutputChannel()

  return new MonacoLanguageClient({
    id: 'Cangjie',
    name: 'Cangjie Language Client',
    clientOptions: {
      documentSelector: ['Cangjie'],
      outputChannel,
      initializationOptions: {
        cangjiePath: '/cangjie',
        cangjieHome: '/cangjie',
        modulesHomeOption: '/cangjie',
      },
      workspaceFolder: buildWorkspaceFolder(),
      errorHandler: {
        error: () => ({ action: ErrorAction.Continue }),
        closed: () => ({ action: CloseAction.DoNotRestart }),
      },
    },
    messageTransports: {
      reader: new BrowserMessageReader(port),
      writer: new BrowserMessageWriter(port),
    },
  })
}

export function isLanguageClientAvailable(): boolean {
  return !isMobile({ tablet: true, featureDetect: true })
}
