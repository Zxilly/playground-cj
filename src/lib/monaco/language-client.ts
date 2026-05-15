import * as monaco from '@codingame/monaco-vscode-editor-api'
import { MonacoLanguageClient } from 'monaco-languageclient'
import { BrowserMessageReader, BrowserMessageWriter, CloseAction, ErrorAction } from 'vscode-languageclient/browser'
import type { OutputChannel } from 'vscode'
import isMobile from 'is-mobile'
import { HMR_SLOT_KEYS, hmrSlot } from '@/lib/hmr-store'
import { CANGJIE_LANGUAGE_ID, CANGJIE_LANGUAGE_NAME } from './language'

// A single Output Channel shared across every LanguageClient instance.
// When clientOptions.outputChannel is set, vscode-languageclient treats it
// as caller-owned and skips disposing it (see _disposeOutputChannel) —
// which eliminates the doCreateOutputChannel / store-disposed race that
// otherwise fires on every LSP restart and leaks a channel each time.
// Stored on globalThis so HMR module re-eval doesn't drop the existing channel
// and create a duplicate one on the next LSP boot.
interface OutputChannelState {
  channel: OutputChannel | null
  pending: Promise<OutputChannel> | null
}

const channelState = hmrSlot<OutputChannelState>(HMR_SLOT_KEYS.LSP_OUTPUT_CHANNEL, () => ({
  channel: null,
  pending: null,
}))

async function getSharedOutputChannel(): Promise<OutputChannel> {
  if (channelState.channel)
    return channelState.channel
  if (!channelState.pending) {
    channelState.pending = import('@codingame/monaco-vscode-extension-api')
      .then(({ window }) => {
        channelState.channel = window.createOutputChannel(CANGJIE_LANGUAGE_NAME) as unknown as OutputChannel
        return channelState.channel
      })
      .finally(() => {
        channelState.pending = null
      })
  }
  return channelState.pending
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
    id: CANGJIE_LANGUAGE_NAME,
    name: `${CANGJIE_LANGUAGE_NAME} Language Client`,
    clientOptions: {
      documentSelector: [CANGJIE_LANGUAGE_ID],
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

import.meta.webpackHot?.accept()
