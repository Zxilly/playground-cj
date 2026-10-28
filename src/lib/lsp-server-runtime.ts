import {
  PLAYGROUND_PROJECT_MANIFEST,
} from '@/lib/monaco/lsp-document-mirror'

// Pthread workers spawned by the emscripten module inherit the JS glue's
// query string via `import.meta.url`, so they hit the same cached URL as
// the main thread without extra revalidation round-trips.
const WASM_ASSETS_VERSION = process.env.WASM_ASSETS_VERSION ?? 'fallback'
const CJO_TARGET = process.env.CJO_TARGET ?? ''
export const CJO_MODULES = JSON.parse(process.env.CJO_MODULES ?? '[]') as readonly string[]
const WASM_ASSETS_VERSION_QS = `?v=${WASM_ASSETS_VERSION}`
const LSP_WASM_PATH = `/lsp/LSPServer-wasm.js${WASM_ASSETS_VERSION_QS}`
const LSP_WASM_BINARY_PATH = `/lsp/LSPServer-wasm.wasm${WASM_ASSETS_VERSION_QS}`
const LSP_MODULES_PATH = '/lsp/modules'

// Disable all WASM + CJO caching in dev so a freshly built wasm/cjo is
// picked up without manually clearing site data.
const CACHE_ENABLED = process.env.NODE_ENV !== 'development'

const CACHE_VERSION_PATH = '/lsp/.cache-version'
const WASM_CACHE_NAME_PREFIX = 'wasm-'
const CJO_DB_NAME = 'cjo-cache'
const CJO_STORE_NAME = 'modules'
const wasmCacheName = `${WASM_CACHE_NAME_PREFIX}${WASM_ASSETS_VERSION}`
const WASM_FATAL_RE = /\babort\(|RuntimeError|Uncaught/
const CJO_FETCH_ATTEMPTS = 3
const CJO_FETCH_TIMEOUT_MS = 15_000
const CJO_CACHE_OPEN_TIMEOUT_MS = 2_000

async function checkAndUpdateCacheVersion(): Promise<void> {
  if (!CACHE_ENABLED) {
    console.log('[Cache] Disabled (dev); clearing any existing entries')
    await clearAllLspCache()
    return
  }

  // This runs in a dedicated Worker, where localStorage is unavailable.
  // Keep the marker with the WASM cache so clearing caches also invalidates it.
  try {
    const cache = await caches.open(wasmCacheName)
    const marker = await cache.match(CACHE_VERSION_PATH)
    const storedVersion = marker ? await marker.text() : null
    if (storedVersion !== WASM_ASSETS_VERSION) {
      console.log(`[Cache] Build version changed: ${storedVersion} -> ${WASM_ASSETS_VERSION}`)
      await clearAllLspCache()
      const freshCache = await caches.open(wasmCacheName)
      await freshCache.put(CACHE_VERSION_PATH, new Response(WASM_ASSETS_VERSION))
    }
  }
  catch (error) {
    // Versioned WASM URLs and CJO keys remain safe even when storage cannot be
    // inspected or cleared. Cache availability must not gate language services.
    console.warn('[Cache] Version check failed; continuing with versioned assets:', error)
  }
}

async function cachedFetch(url: string, cacheName: string): Promise<Response> {
  if (!CACHE_ENABLED) {
    return fetch(url, { cache: 'no-cache' })
  }

  let cache: Cache | undefined
  try {
    cache = await caches.open(cacheName)
    const cached = await cache.match(url)
    if (cached) {
      console.log(`[Cache] Hit: ${url}`)
      return cached
    }
  }
  catch (error) {
    console.warn('[Cache] WASM cache read failed; downloading:', error)
  }

  console.log(`[Cache] Miss: ${url}, fetching...`)
  const response = await fetch(url)

  if (response.ok && cache) {
    try {
      await cache.put(url, response.clone())
      console.log(`[Cache] Stored: ${url}`)
    }
    catch (error) {
      console.warn('[Cache] WASM cache write failed; using downloaded bytes:', error)
    }
  }

  return response
}

async function clearWasmCache(): Promise<void> {
  const keys = await caches.keys()
  await Promise.all(
    keys.filter(key => key.startsWith('wasm-')).map(async (key) => {
      await caches.delete(key)
      console.log(`[Cache] Cleared WASM cache: ${key}`)
    }),
  )
}

async function clearCjoCache(): Promise<void> {
  try {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(CJO_DB_NAME)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error('CJO cache is in use by another tab'))
    })
    console.log(`[Cache] Cleared CJO cache: ${CJO_DB_NAME}`)
  }
  catch (e) {
    console.warn(`[Cache] Failed to clear CJO cache:`, e)
  }
}

export async function clearAllLspCache(): Promise<void> {
  const results = await Promise.allSettled([clearWasmCache(), clearCjoCache()])
  for (const result of results) {
    if (result.status === 'rejected')
      console.warn('[Cache] Could not clear LSP cache:', result.reason)
  }
}

export interface EmscriptenModule {
  getVersion: () => string
  onLSPMessage: (messageStr: string) => void
  initLSP: () => void
  startServerLoop: () => void
  processMessage: (message: string) => void
  FS: {
    mkdir: (path: string) => void
    writeFile: (path: string, data: Uint8Array) => void
    analyzePath?: (path: string) => { exists: boolean }
    stat?: (path: string) => unknown
  }
}

function mkdirP(fs: EmscriptenModule['FS'], path: string): void {
  const parts = path.split('/').filter(Boolean)
  let cur = ''
  for (const p of parts) {
    cur += `/${p}`
    try {
      fs.mkdir(cur)
    }
    catch {}
  }
}

function openCjoDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CJO_DB_NAME, 1)
    let settled = false
    let timeout: ReturnType<typeof setTimeout> | undefined
    const fail = (error: unknown) => {
      settled = true
      clearTimeout(timeout)
      reject(error)
    }
    // A previous tab may keep the database open while a deletion is queued.
    // Do not wait indefinitely for that tab before falling back to downloads.
    timeout = setTimeout(() => fail(new Error('CJO cache open timed out')), CJO_CACHE_OPEN_TIMEOUT_MS)
    request.onerror = () => fail(request.error)
    request.onblocked = () => fail(new Error('CJO cache open blocked'))
    request.onsuccess = () => {
      const db = request.result
      clearTimeout(timeout)
      if (settled) {
        db.close()
        return
      }
      settled = true
      db.onversionchange = () => db.close()
      resolve(db)
    }
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(CJO_STORE_NAME)) {
        db.createObjectStore(CJO_STORE_NAME)
      }
    }
  })
}

function idbGet(db: IDBDatabase, key: string): Promise<Uint8Array | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CJO_STORE_NAME, 'readonly')
    const request = tx.objectStore(CJO_STORE_NAME).get(key)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const data = request.result
      resolve(ArrayBuffer.isView(data) && Object.prototype.toString.call(data) === '[object Uint8Array]' && data.byteLength > 0
        ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
        : null)
    }
  })
}

// Fire-and-forget: cache writes are best-effort, failures are non-fatal.
function idbPut(db: IDBDatabase, key: string, data: Uint8Array): void {
  try {
    const tx = db.transaction(CJO_STORE_NAME, 'readwrite')
    tx.objectStore(CJO_STORE_NAME).put(data, key)
  }
  catch {}
}

export interface LspServerCallbacks {
  onMessage: (label: 'Response' | 'Notification', json: object) => void
  onLog: (msg: string) => void
  onError: (err: Error) => void
  onStdlibProgress?: (progress: { loaded: number, total: number }) => void
}

interface WasmFactoryOptions {
  print: (text: string) => void
  printErr: (text: string) => void
  preRun: ((module: EmscriptenModule) => void)[]
  instantiateWasm: (
    imports: WebAssembly.Imports,
    successCallback: (instance: WebAssembly.Instance, module: WebAssembly.Module) => void,
  ) => object
}

type WasmFactory = (options: WasmFactoryOptions) => Promise<EmscriptenModule>

async function loadWasmFactory(): Promise<WasmFactory> {
  const wasmModule = await import(/* webpackIgnore: true */ /* @vite-ignore */ LSP_WASM_PATH)
  return wasmModule.default
}

async function downloadCjoModule(url: string): Promise<Uint8Array> {
  for (let attempt = 1; ; attempt++) {
    let retryable = true
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(CJO_FETCH_TIMEOUT_MS) })
      if (!response.ok) {
        retryable = response.status === 408 || response.status === 429 || response.status >= 500
        throw new Error(`HTTP ${response.status}`)
      }
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.byteLength === 0)
        throw new Error('Empty standard library module')
      return bytes
    }
    catch (error) {
      if (!retryable || attempt >= CJO_FETCH_ATTEMPTS)
        throw error
      await new Promise(resolve => setTimeout(resolve, 250 * attempt))
    }
  }
}

export async function initializeLspServerInWorker(
  callbacks: LspServerCallbacks,
  shouldAbort: () => boolean,
  loadFactory: () => Promise<WasmFactory> = loadWasmFactory,
): Promise<EmscriptenModule> {
  const { onMessage, onLog, onError } = callbacks

  await checkAndUpdateCacheVersion()
  if (shouldAbort())
    throw new Error('aborted')

  onLog('Loading WASM module...')

  // Directories the stdlib loader will write into. Cangjie's static init
  // (inside the wasm factory) also expects `/cangjie/modules/<target>/` to
  // exist — create everything in preRun so it's ready before main() runs.
  const targetModulesPath = `/cangjie/modules/${CJO_TARGET}`
  const moduleDirs = new Set<string>()
  for (const modulePath of CJO_MODULES) {
    const idx = modulePath.lastIndexOf('/')
    if (idx > 0) {
      moduleDirs.add(modulePath.slice(0, idx))
    }
  }

  const createWasmModule = await loadFactory()
  if (shouldAbort())
    throw new Error('aborted')

  let rejectInstantiation!: (error: Error) => void
  const instantiationFailure = new Promise<never>((_resolve, reject) => {
    rejectInstantiation = reject
  })
  const wasmModulePromise = createWasmModule({
    print: (text: string) => onLog(`[stdout] ${text}`),
    printErr: (text: string) => {
      onLog(`[stderr] ${text}`)
      // WASM abort / native RuntimeError is fatal — surface it so the
      // controller can treat it as a crash and trigger auto-restart.
      if (WASM_FATAL_RE.test(text)) {
        onError(new Error(`WASM fatal: ${text}`))
      }
    },
    preRun: [(mod: EmscriptenModule) => {
      mkdirP(mod.FS, targetModulesPath)
      for (const dir of moduleDirs) {
        mkdirP(mod.FS, `${targetModulesPath}/${dir}`)
      }
      mkdirP(mod.FS, '/playground/src')
      mod.FS.writeFile(
        '/playground/cjpm.toml',
        new TextEncoder().encode(PLAYGROUND_PROJECT_MANIFEST),
      )
      mod.FS.writeFile('/playground/src/main.cj', new Uint8Array())
    }],
    // Emscripten contract: async path must call successCallback() and
    // return {} — never return a Promise or exports object.
    instantiateWasm: (
      imports: WebAssembly.Imports,
      successCallback: (instance: WebAssembly.Instance, module: WebAssembly.Module) => void,
    ) => {
      cachedFetch(LSP_WASM_BINARY_PATH, wasmCacheName)
        .then((response) => {
          if (!response.ok)
            throw new Error(`HTTP ${response.status}`)
          return response.arrayBuffer()
        })
        .then(bytes => WebAssembly.instantiate(bytes, imports))
        .then(result => successCallback(result.instance, result.module))
        .catch((e) => {
          const error = new Error(`Failed to instantiate WASM: ${(e as Error).message}`)
          onError(error)
          // Emscripten's async instantiateWasm contract has no error callback.
          // Reject a parallel promise so initialization and queued teardown do
          // not wait forever for a success callback that will never arrive.
          rejectInstantiation(error)
        })
      return {}
    },
  })
  const wasmMod: EmscriptenModule = await Promise.race([wasmModulePromise, instantiationFailure])
  if (shouldAbort())
    throw new Error('aborted')

  const lspMessageHandler = (messageStr: string) => {
    try {
      const json = JSON.parse(messageStr)
      const label = (json.method && json.id === undefined) ? 'Notification' : 'Response'
      onMessage(label, json)
    }
    catch (e) {
      onError(new Error(`Failed to parse LSP message: ${(e as Error).message}`))
    }
  }
  wasmMod.onLSPMessage = lspMessageHandler

  onLog(`Cangjie LSP ${wasmMod.getVersion()}`)
  onLog('Initializing LSP server...')
  wasmMod.initLSP()

  onLog('Loading standard library...')

  let loaded = 0
  let cached = 0
  let downloaded = 0
  const failed: string[] = []
  callbacks.onStdlibProgress?.({ loaded, total: CJO_MODULES.length })

  let db: IDBDatabase | null = null
  if (CACHE_ENABLED) {
    try {
      db = await openCjoDatabase()
    }
    catch (e) {
      console.warn('[Cache] CJO IndexedDB open failed; modules will be re-downloaded:', e)
    }
  }

  await Promise.all(CJO_MODULES.map(async (modulePath) => {
    const destPath = `${targetModulesPath}/${modulePath}`
    // Never reuse unversioned entries from an older build when cache cleanup
    // fails, or when another tab writes its older modules after invalidation.
    const cacheKey = `${WASM_ASSETS_VERSION}:${modulePath}`

    try {
      let cachedData: Uint8Array | null = null
      if (db) {
        try {
          cachedData = await idbGet(db, cacheKey)
        }
        catch (error) {
          onLog(`  [cjo] Cache read failed; downloading ${modulePath}: ${String(error)}`)
        }
      }

      if (cachedData) {
        wasmMod.FS.writeFile(destPath, cachedData)
        loaded++
        cached++
      }
      else {
        const url = `${LSP_MODULES_PATH}/${CJO_TARGET}/${modulePath}${WASM_ASSETS_VERSION_QS}`
        const data = await downloadCjoModule(url)
        wasmMod.FS.writeFile(destPath, data)

        if (db)
          idbPut(db, cacheKey, data)

        loaded++
        downloaded++
      }
      callbacks.onStdlibProgress?.({ loaded, total: CJO_MODULES.length })
    }
    catch (e) {
      failed.push(modulePath)
      onLog(`  [cjo] FAILED: ${modulePath} - ${(e as Error).message}`)
    }
  }))

  db?.close()
  onLog(`Loaded ${loaded}/${CJO_MODULES.length} stdlib modules (${cached} cached, ${downloaded} downloaded)`)
  if (shouldAbort())
    throw new Error('aborted')
  if (failed.length > 0) {
    throw new Error(`Standard library incomplete: loaded ${loaded}/${CJO_MODULES.length} modules; failed: ${failed.join(', ')}`)
  }

  onLog('Starting server loop...')
  wasmMod.startServerLoop()

  return wasmMod
}
