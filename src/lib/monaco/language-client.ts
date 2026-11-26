import * as monaco from '@codingame/monaco-vscode-editor-api'
import type { LogLevel, LogOutputChannel } from 'vscode'
import type { MonacoLanguageClient } from './vscode-api/monaco-language-client'
import isMobile from 'is-mobile'
import { HMR_SLOT_KEYS, hmrSlot } from '@/lib/hmr-store'
import { createCangjieProtocolMiddleware } from './cangjie-protocol'
import { CANGJIE_LANGUAGE_ID, CANGJIE_LANGUAGE_NAME } from './language'
import { LatestLanguageClientController } from './language-client-controller'
import { ensureExtensionHost } from './vscode-api/extension-host'

// A lightweight caller-owned LogOutputChannel shared across every LanguageClient
// instance. Supplying our own channel eliminates the dependency on VS Code's
// heavy output-service-override / views-service-override and prevents
// vscode-languageclient from creating or disposing workbench output channels on
// LSP restarts.
interface OutputChannelState {
  channel: LogOutputChannel | null
}

const channelState = hmrSlot<OutputChannelState>(HMR_SLOT_KEYS.LSP_OUTPUT_CHANNEL, () => ({
  channel: null,
}))

function createConsoleLogOutputChannel(name: string): LogOutputChannel {
  const noopDisposable = { dispose: () => {} }
  const prefix = `[LSP:${name}]`
  return {
    name,
    logLevel: 3 as LogLevel, // LogLevel.Info
    onDidChangeLogLevel: () => noopDisposable,
    trace: (message: string, ...args: unknown[]) => console.debug(prefix, message, ...args),
    debug: (message: string, ...args: unknown[]) => console.debug(prefix, message, ...args),
    info: (message: string, ...args: unknown[]) => console.info(prefix, message, ...args),
    warn: (message: string, ...args: unknown[]) => console.warn(prefix, message, ...args),
    error: (error: string | Error, ...args: unknown[]) => console.error(prefix, error, ...args),
    append: () => {},
    appendLine: (value: string) => console.debug(prefix, value),
    replace: () => {},
    clear: () => {},
    show: () => {},
    hide: () => {},
    dispose: () => {},
  }
}

function getSharedOutputChannel(): LogOutputChannel {
  channelState.channel ??= createConsoleLogOutputChannel(CANGJIE_LANGUAGE_NAME)
  return channelState.channel
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

  await ensureExtensionHost()

  // The editor can render before the WASM server is ready. Load the protocol
  // client only when there is a live port to connect, not with the editor UI.
  const [{ BrowserMessageReader, BrowserMessageWriter, CloseAction, ErrorAction }, { MonacoLanguageClient }] = await Promise.all([
    import('vscode-languageclient/browser'),
    import('./vscode-api/monaco-language-client'),
  ])
  const outputChannel = getSharedOutputChannel()

  return new MonacoLanguageClient({
    id: CANGJIE_LANGUAGE_NAME,
    name: `${CANGJIE_LANGUAGE_NAME} Language Client`,
    clientOptions: {
      documentSelector: [CANGJIE_LANGUAGE_ID],
      middleware: createCangjieProtocolMiddleware(),
      outputChannel,
      initializationOptions: {
        cangjiePath: '/cangjie',
        cangjieHome: '/cangjie',
        modulesHomeOption: '/cangjie',
        standaloneDocuments: true,
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
// per-editor clients. Editors acquire a lightweight service lease while this
// singleton client serves every matching model.
interface SharedClientSlot {
  controller?: LatestLanguageClientController<MessagePort, MonacoLanguageClient>
  // Pre-controller fields are retained only so an HMR update can adopt the
  // already-running client without dropping the live server connection.
  client?: MonacoLanguageClient
  port?: MessagePort
  startedPromise?: Promise<MonacoLanguageClient | undefined>
}

const sharedClient = hmrSlot<SharedClientSlot>(HMR_SLOT_KEYS.LSP_LANGUAGE_CLIENT, () => ({
  controller: new LatestLanguageClientController<MessagePort, MonacoLanguageClient>(),
}))

if (!sharedClient.controller) {
  sharedClient.controller = new LatestLanguageClientController<MessagePort, MonacoLanguageClient>()
  if (sharedClient.client && sharedClient.port) {
    sharedClient.controller.adopt(sharedClient.port, sharedClient.client)
  }
  else if (sharedClient.startedPromise && sharedClient.port) {
    const legacyPort = sharedClient.port
    void sharedClient.startedPromise.then((client) => {
      if (client) {
        sharedClient.controller?.adopt(legacyPort, client)
      }
    })
  }
  delete sharedClient.client
  delete sharedClient.port
  delete sharedClient.startedPromise
}

/**
 * Ensure a single, page-wide MonacoLanguageClient is started against `port`
 * and serves every Cangjie model on the page. Idempotent — repeated calls
 * with the same port return the same client; if the port has changed
 * (LSP restart), the old client is torn down first.
 */
export async function ensureLanguageClient(port: MessagePort): Promise<MonacoLanguageClient | undefined> {
  if (isMobile({ tablet: true, featureDetect: true }))
    return undefined
  try {
    return await sharedClient.controller!.ensure(port, createLanguageClient)
  }
  catch (e) {
    const message = e instanceof Error ? e.message : JSON.stringify(e)
    console.warn(`[LSP] ensureLanguageClient: client.start() failed: ${message}`)
    return undefined
  }
}

export async function disposeLanguageClient(): Promise<void> {
  await sharedClient.controller!.dispose()
}

export function isLanguageClientAvailable(): boolean {
  return !isMobile({ tablet: true, featureDetect: true })
}

import.meta.webpackHot?.accept()
