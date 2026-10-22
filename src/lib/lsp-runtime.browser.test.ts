import { afterEach, beforeEach, expect, it } from 'vitest'
import toolchainLock from '../../cj-runner/cangjie-toolchain.lock.json'
import { CJO_MODULES, clearAllLspCache } from './lsp-server-runtime'

beforeEach(clearAllLspCache)
afterEach(clearAllLspCache)

async function initializeWorker(verify?: (port: MessagePort) => Promise<void>) {
  const logs: string[] = []
  const worker = new Worker(new URL('../workers/lsp-runtime.worker.ts', import.meta.url), { type: 'module' })
  const channel = new MessageChannel()
  let rejectFailure: (error: Error) => void = () => {}
  const failure = new Promise<never>((_resolve, reject) => {
    rejectFailure = reject
  })
  void failure.catch(() => {})
  try {
    const initialized = new Promise<{ capabilities: object }>((resolve, reject) => {
      worker.onerror = event => rejectFailure(new Error(event.message))
      worker.onmessage = ({ data }) => {
        if (data.type === 'log')
          logs.push(data.message)
        if (data.type === 'error')
          rejectFailure(new Error(data.message))
        if (data.type === 'ready') {
          channel.port1.postMessage({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
              processId: null,
              rootUri: 'file:///playground',
              capabilities: { textDocument: {} },
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
    expect((await Promise.race([initialized, failure])).capabilities).toHaveProperty('textDocumentSync')
    expect(logs).toContain(`Cangjie LSP ${toolchainLock.release}`)
    channel.port1.postMessage({ jsonrpc: '2.0', method: 'initialized', params: {} })
    await Promise.race([verify?.(channel.port1), failure])
    return logs
  }
  finally {
    worker.terminate()
    channel.port1.close()
  }
}

it('type-checks STDX imports with the matching CJO modules and updates diagnostics', async () => {
  await initializeWorker(async (port) => {
    const uri = 'file:///playground/src/main.cj'
    const diagnostics: { message: string, severity: number }[][] = []
    port.onmessage = ({ data }) => {
      if (data.method === 'textDocument/publishDiagnostics' && data.params.uri === uri)
        diagnostics.push(data.params.diagnostics)
    }
    const source = (type: string) => `import stdx.encoding.base64.*\nmain() {\n    let encoded: ${type} = toBase64String("test".toArray())\n    println(encoded)\n}\n`
    port.postMessage({
      jsonrpc: '2.0',
      method: 'textDocument/didOpen',
      params: { textDocument: { uri, languageId: 'Cangjie', version: 1, text: source('Int64') } },
    })
    await expect.poll(() => diagnostics.flat(), { timeout: 30_000 }).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: 1, message: expect.stringMatching(/Int64/) }),
    ]))

    diagnostics.length = 0
    port.postMessage({
      jsonrpc: '2.0',
      method: 'textDocument/didChange',
      params: { textDocument: { uri, version: 2 }, contentChanges: [{ text: source('String') }] },
    })
    await expect.poll(() => diagnostics.at(-1), { timeout: 30_000 }).toEqual([])
  })
}, 60_000)

it('keeps overlapping completions valid during diagnostic rebuilds', async () => {
  await initializeWorker(async (port) => {
    const uri = 'file:///playground/src/main.cj'
    interface CompletionItem { label: string }
    const responses = new Map<number, { result?: { items?: CompletionItem[] } | CompletionItem[], error?: unknown }>()
    const diagnostics: { message: string }[][] = []
    port.onmessage = ({ data }) => {
      if (typeof data.id === 'number')
        responses.set(data.id, data)
      if (data.method === 'textDocument/publishDiagnostics' && data.params.uri === uri)
        diagnostics.push(data.params.diagnostics)
    }
    const invalid = 'main() { let value: Int64 = "wrong" }'
    const incomplete = (name: string) => `main() {\n    let ${name}: Int64 = 1\n    localV\n}`
    port.postMessage({
      jsonrpc: '2.0',
      method: 'textDocument/didOpen',
      params: { textDocument: { uri, languageId: 'Cangjie', version: 1, text: invalid } },
    })
    await expect.poll(() => diagnostics.flat(), { timeout: 30_000 }).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: expect.stringMatching(/Int64/) }),
    ]))
    for (let round = 0; round < 20; round += 1) {
      const version = round * 2 + 2
      const localName = `localValue${round}`
      port.postMessage({
        jsonrpc: '2.0',
        method: 'textDocument/didChange',
        params: { textDocument: { uri, version }, contentChanges: [{ text: incomplete(localName) }] },
      })
      const id = round + 1100
      // Typing and an explicit completion invocation can issue adjacent requests.
      for (const requestId of [id - 1000, id]) {
        port.postMessage({
          jsonrpc: '2.0',
          id: requestId,
          method: 'textDocument/completion',
          params: { textDocument: { uri }, position: { line: 2, character: 10 }, context: { triggerKind: 1 } },
        })
      }
      await expect.poll(() => responses.has(id), { timeout: 10_000 }).toBe(true)
      const response = responses.get(id)!
      expect(response.error).toBeUndefined()
      const items = Array.isArray(response.result) ? response.result : response.result?.items
      expect(items, JSON.stringify({ round, response })).toEqual(expect.arrayContaining([
        expect.objectContaining({ label: localName }),
      ]))
      diagnostics.length = 0
      port.postMessage({
        jsonrpc: '2.0',
        method: 'textDocument/didChange',
        params: { textDocument: { uri, version: version + 1 }, contentChanges: [{ text: invalid }] },
      })
      await expect.poll(() => diagnostics.flat(), { timeout: 10_000 }).toEqual(expect.arrayContaining([
        expect.objectContaining({ message: expect.stringMatching(/Int64/) }),
      ]))
    }
  })
}, 90_000)

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
