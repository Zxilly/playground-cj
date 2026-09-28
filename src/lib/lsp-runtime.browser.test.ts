import { afterEach, beforeEach, expect, it } from 'vitest'
import { CJO_MODULES, clearAllLspCache } from './lsp-server-runtime'

beforeEach(clearAllLspCache)
afterEach(clearAllLspCache)

async function initializeWorker() {
  const logs: string[] = []
  const worker = new Worker(new URL('../workers/lsp-runtime.worker.ts', import.meta.url), { type: 'module' })
  const channel = new MessageChannel()
  try {
    const initialized = new Promise<{ capabilities: object }>((resolve, reject) => {
      worker.onerror = event => reject(new Error(event.message))
      worker.onmessage = ({ data }) => {
        if (data.type === 'log')
          logs.push(data.message)
        if (data.type === 'error')
          reject(new Error(data.message))
        if (data.type === 'ready') {
          channel.port1.postMessage({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
              processId: null,
              rootUri: 'file:///playground',
              capabilities: {},
              workspaceFolders: [{ uri: 'file:///playground', name: 'playground' }],
              initializationOptions: {
                cangjiePath: '/cangjie',
                cangjieHome: '/cangjie',
                modulesHomeOption: '/cangjie',
                standaloneDocuments: true,
              },
            },
          })
        }
      }
      channel.port1.onmessage = ({ data }) => {
        if (data.id === 1) {
          if (data.error)
            reject(new Error(JSON.stringify(data.error)))
          else
            resolve(data.result)
        }
      }
    })
    worker.postMessage({ type: 'start', serverPort: channel.port2 }, [channel.port2])
    expect((await initialized).capabilities).toHaveProperty('textDocumentSync')
    return logs
  }
  finally {
    worker.terminate()
    channel.port1.close()
  }
}

it('starts the real LSP worker with production caching and answers initialize', async () => {
  expect(CJO_MODULES.length).toBeGreaterThan(0)
  const coldLogs = await initializeWorker()
  expect(coldLogs).toContain(`Loaded ${CJO_MODULES.length}/${CJO_MODULES.length} stdlib modules (0 cached, ${CJO_MODULES.length} downloaded)`)

  const warmLogs = await initializeWorker()
  expect(warmLogs).toContain(`Loaded ${CJO_MODULES.length}/${CJO_MODULES.length} stdlib modules (${CJO_MODULES.length} cached, 0 downloaded)`)
}, 60_000)

it('invalidates old WASM and CJO caches before starting a new asset version', async () => {
  await initializeWorker()
  const cache = await caches.open('wasm-browser-test')
  await cache.put('/lsp/.cache-version', new Response('old-version'))
  await caches.open('wasm-old-version')

  const logs = await initializeWorker()
  expect(logs).toContain(`Loaded ${CJO_MODULES.length}/${CJO_MODULES.length} stdlib modules (0 cached, ${CJO_MODULES.length} downloaded)`)
  expect(await caches.keys()).not.toContain('wasm-old-version')
  const freshCache = await caches.open('wasm-browser-test')
  expect(await (await freshCache.match('/lsp/.cache-version'))?.text()).toBe('browser-test')
}, 60_000)
