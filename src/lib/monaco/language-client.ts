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
 *
 * Prefer `ensureLanguageClient` over this for app-level use — `createLanguageClient`
 * is exported for tests and lower-level callers that explicitly need a fresh
 * instance.
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

// Singleton language client per page. Multiple editors on the same page (e.g.
// the main tour editor + N exercise cards) MUST share a single MonacoLanguageClient
// — each client wraps a `BrowserMessageReader` on the same MessagePort, and a
// MessagePort only has one effective `onmessage` consumer at a time. Two
// clients on the same port produces protocol corruption and stalled LSP.
//
// The client's `documentSelector` is `[CANGJIE_LANGUAGE_ID]` (above) so it
// serves ALL Cangjie models in the registry regardless of URI — no need for
// per-editor clients. Exercise editors keep `enableLanguageClient={false}` to skip
// per-editor lifecycle, but the singleton client below covers them.
interface SharedClientSlot {
  client: MonacoLanguageClient | undefined
  port: MessagePort | undefined
  startedPromise: Promise<MonacoLanguageClient | undefined> | undefined
}

const sharedClient = hmrSlot<SharedClientSlot>(HMR_SLOT_KEYS.LSP_LANGUAGE_CLIENT, () => ({
  client: undefined,
  port: undefined,
  startedPromise: undefined,
}))

/**
 * Ensure a single, page-wide MonacoLanguageClient is started against `port`
 * and serves every Cangjie model on the page. Idempotent — repeated calls
 * with the same port return the same client; if the port has changed
 * (LSP restart), the old client is torn down first.
 */
export async function ensureLanguageClient(port: MessagePort): Promise<MonacoLanguageClient | undefined> {
  if (isMobile({ tablet: true, featureDetect: true }))
    return undefined

  if (sharedClient.client && sharedClient.port === port)
    return sharedClient.client

  // Port changed mid-session (LSP server restart). Tear down the old client
  // first; until the new one finishes booting, callers see `undefined`.
  if (sharedClient.client) {
    const prev = sharedClient.client
    sharedClient.client = undefined
    sharedClient.port = undefined
    sharedClient.startedPromise = undefined
    try {
      await prev.stop()
    }
    catch {}
    try {
      await prev.dispose()
    }
    catch {}
  }

  if (!sharedClient.startedPromise || sharedClient.port !== port) {
    sharedClient.port = port
    sharedClient.startedPromise = (async () => {
      const client = await createLanguageClient(port)
      if (!client)
        return undefined
      try {
        await client.start()
      }
      catch (e) {
        const m = e instanceof Error ? e.message : JSON.stringify(e)
        console.warn(`[LSP] ensureLanguageClient: client.start() failed: ${m}`)
        try {
          await client.dispose()
        }
        catch {}
        return undefined
      }
      sharedClient.client = client
      return client
    })()
  }
  return sharedClient.startedPromise
}

export function isLanguageClientAvailable(): boolean {
  return !isMobile({ tablet: true, featureDetect: true })
}

import.meta.webpackHot?.accept()
