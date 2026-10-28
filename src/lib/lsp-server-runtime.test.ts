import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EmscriptenModule } from './lsp-server-runtime'

const MODULES = ['std/std.core.cjo', 'stdx/stdx.encoding.cjo']
const VERSION = 'runtime-test'
const CACHE_NAME = `wasm-${VERSION}`

function assetResponse(url: RequestInfo | URL) {
  // A valid empty WASM module exercises the byte-instantiation path without
  // importing the real language server into a jsdom unit test.
  const bytes = String(url).includes('.wasm')
    ? [0, 97, 115, 109, 1, 0, 0, 0]
    : [1, 2, 3]
  return new Response(new Uint8Array(bytes))
}

function createCaches() {
  const entries = new Map<string, Response>([
    ['/lsp/.cache-version', new Response(VERSION)],
  ])
  const cache = {
    match: vi.fn(async (key: string) => entries.get(key)?.clone()),
    put: vi.fn(async (key: string, value: Response) => { entries.set(key, value.clone()) }),
  }
  const storage = {
    open: vi.fn(async () => cache),
    keys: vi.fn(async () => [CACHE_NAME]),
    delete: vi.fn(async () => {
      entries.clear()
      return true
    }),
  }
  return { cache, storage }
}

async function seedCjoCache(entries: Record<string, number[]>) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('cjo-cache', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('modules')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('modules', 'readwrite')
    for (const [key, bytes] of Object.entries(entries))
      tx.objectStore('modules').put(new Uint8Array(bytes), key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

async function createRuntime() {
  const { initializeLspServerInWorker } = await import('./lsp-server-runtime')
  const wasmModule: EmscriptenModule = {
    getVersion: () => 'test',
    onLSPMessage: () => {},
    initLSP: vi.fn(),
    startServerLoop: vi.fn(),
    processMessage: vi.fn(),
    FS: { mkdir: vi.fn(), writeFile: vi.fn() },
  }
  const callbacks = {
    onMessage: vi.fn(),
    onLog: vi.fn(),
    onError: vi.fn(),
    onStdlibProgress: vi.fn(),
  }
  const start = () => initializeLspServerInWorker(callbacks, () => false, async () => options => new Promise((resolve) => {
    for (const preRun of options.preRun)
      preRun(wasmModule)
    options.instantiateWasm({}, () => resolve(wasmModule))
  }))
  return { start, module: wasmModule, callbacks }
}

describe('lsp runtime asset failures', () => {
  let caches: ReturnType<typeof createCaches>
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('WASM_ASSETS_VERSION', VERSION)
    vi.stubEnv('CJO_TARGET', 'linux_x86_64_cjnative')
    vi.stubEnv('CJO_MODULES', JSON.stringify(MODULES))
    caches = createCaches()
    vi.stubGlobal('caches', caches.storage)
    vi.stubGlobal('indexedDB', new IDBFactory())
    fetchMock = vi.fn<typeof fetch>(async url => assetResponse(url))
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(WebAssembly, 'instantiate')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it.each(['open', 'match', 'put'] as const)('starts with downloaded assets when Cache.%s fails', async (operation) => {
    const error = new DOMException('Storage unavailable', 'QuotaExceededError')
    if (operation === 'open')
      caches.storage.open.mockRejectedValue(error)
    else
      caches.cache[operation].mockRejectedValue(error)
    const runtime = await createRuntime()

    await expect(runtime.start()).resolves.toBe(runtime.module)

    expect(WebAssembly.instantiate).toHaveBeenCalledOnce()
    expect(runtime.module.startServerLoop).toHaveBeenCalledOnce()
    expect(runtime.callbacks.onStdlibProgress).toHaveBeenLastCalledWith({ loaded: 2, total: 2 })
    expect(runtime.callbacks.onError).not.toHaveBeenCalled()
  })

  it('does not reuse old or unversioned CJO entries when cache invalidation is unavailable', async () => {
    await seedCjoCache({
      [MODULES[0]!]: [99],
      [`old:${MODULES[1]}`]: [99],
    })
    caches.storage.open.mockRejectedValue(new Error('Cache API unavailable'))
    const runtime = await createRuntime()

    await runtime.start()

    for (const name of MODULES) {
      expect(runtime.module.FS.writeFile).toHaveBeenCalledWith(
        `/cangjie/modules/linux_x86_64_cjnative/${name}`,
        new Uint8Array([1, 2, 3]),
      )
    }
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('.cjo'))).toHaveLength(2)
  })

  it('uses current-version CJO entries without downloading them', async () => {
    await seedCjoCache(Object.fromEntries(MODULES.map(name => [`${VERSION}:${name}`, [9]])))
    const runtime = await createRuntime()

    await runtime.start()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(runtime.callbacks.onLog).toHaveBeenCalledWith('Loaded 2/2 stdlib modules (2 cached, 0 downloaded)')
  })

  it('falls back to the network after an IndexedDB read transaction fails', async () => {
    const originalOpen = indexedDB.open.bind(indexedDB)
    vi.spyOn(indexedDB, 'open').mockImplementation((...args) => {
      const request = originalOpen(...args)
      request.addEventListener('success', () => {
        const originalTransaction = request.result.transaction.bind(request.result)
        vi.spyOn(request.result, 'transaction').mockImplementation((...transactionArgs) => {
          if (transactionArgs[1] === 'readonly')
            throw new DOMException('Read unavailable', 'UnknownError')
          return originalTransaction(...transactionArgs)
        })
      })
      return request
    })
    const runtime = await createRuntime()

    await runtime.start()

    expect(runtime.module.startServerLoop).toHaveBeenCalledOnce()
    expect(runtime.callbacks.onLog.mock.calls.filter(([message]) => message.includes('Cache read failed'))).toHaveLength(2)
    expect(runtime.callbacks.onStdlibProgress).toHaveBeenLastCalledWith({ loaded: 2, total: 2 })
  })

  it('does not wait indefinitely for another tab holding the old CJO database open', async () => {
    await seedCjoCache({ [MODULES[0]!]: [99] })
    const oldTabDb = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cjo-cache', 1)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await caches.cache.put('/lsp/.cache-version', new Response('old'))
    const runtime = await createRuntime()
    try {
      await expect(runtime.start()).resolves.toBe(runtime.module)
      expect(runtime.module.startServerLoop).toHaveBeenCalledOnce()
      expect(runtime.callbacks.onLog).toHaveBeenCalledWith('Loaded 2/2 stdlib modules (0 cached, 2 downloaded)')
    }
    finally {
      oldTabDb.close()
    }
  })

  it('retries a transient module response and starts only after all modules are loaded', async () => {
    let moduleAttempts = 0
    fetchMock.mockImplementation(async (url) => {
      if (String(url).includes(MODULES[0]!) && ++moduleAttempts === 1)
        return new Response('', { status: 503 })
      return assetResponse(url)
    })
    const runtime = await createRuntime()

    await runtime.start()

    expect(moduleAttempts).toBe(2)
    expect(runtime.module.startServerLoop).toHaveBeenCalledOnce()
    expect(runtime.callbacks.onStdlibProgress.mock.calls.map(([progress]) => progress.loaded)).toEqual([0, 1, 2])
  })

  it.each([404, 503])('rejects incomplete standard libraries after a bounded HTTP %s failure', async (status) => {
    let moduleAttempts = 0
    fetchMock.mockImplementation(async (url) => {
      if (String(url).includes(MODULES[0]!)) {
        moduleAttempts++
        return new Response('', { status })
      }
      return assetResponse(url)
    })
    const runtime = await createRuntime()

    await expect(runtime.start()).rejects.toThrow(`Standard library incomplete: loaded 1/2 modules; failed: ${MODULES[0]}`)

    expect(moduleAttempts).toBe(status === 404 ? 1 : 3)
    expect(runtime.module.startServerLoop).not.toHaveBeenCalled()
    expect(runtime.callbacks.onStdlibProgress).toHaveBeenLastCalledWith({ loaded: 1, total: 2 })
  })

  it('reports a WASM HTTP failure without attempting to compile the error body', async () => {
    fetchMock.mockResolvedValue(new Response('not found', { status: 404 }))
    const runtime = await createRuntime()

    await expect(runtime.start()).rejects.toThrow('Failed to instantiate WASM: HTTP 404')

    expect(WebAssembly.instantiate).not.toHaveBeenCalled()
    expect(runtime.module.startServerLoop).not.toHaveBeenCalled()
  })
})
