import {
  initializeLspServerInWorker,
} from '@/lib/lsp-server-runtime'
import { createLspDocumentMirror } from '@/lib/monaco/lsp-document-mirror'

interface StartMessage {
  type: 'start'
  serverPort: MessagePort
}

function post(type: 'ready' | 'log' | 'error', message?: string): void {
  globalThis.postMessage({ type, message })
}

globalThis.onmessage = (event: MessageEvent<StartMessage>) => {
  if (event.data.type !== 'start')
    return
  globalThis.onmessage = null
  const { serverPort } = event.data
  void initializeLspServerInWorker(
    {
      onMessage: (_label, json) => serverPort.postMessage(json),
      onLog: message => post('log', message),
      onError: error => post('error', error.message),
    },
    () => false,
  ).then((module) => {
    const documentMirror = createLspDocumentMirror(module.FS)
    serverPort.onmessage = (messageEvent) => {
      const message = typeof messageEvent.data === 'string'
        ? messageEvent.data
        : JSON.stringify(messageEvent.data)
      documentMirror.handle(message)
      module.processMessage(message)
    }
    serverPort.start()
    post('ready')
  }).catch((error: unknown) => {
    post('error', error instanceof Error ? error.message : 'LSP initialization failed')
  })
}
