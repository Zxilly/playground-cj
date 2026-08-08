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

export const CACHE_STORAGE_KEY = 'wasm-assets-cache-version'
const WASM_CACHE_NAME_PREFIX = 'wasm-'
const CJO_DB_NAME = 'cjo-cache'
const CJO_STORE_NAME = 'modules'
const wasmCacheName = `${WASM_CACHE_NAME_PREFIX}${WASM_ASSETS_VERSION}`
const WASM_FATAL_RE = /\babort\(|RuntimeError|Uncaught/

async function checkAndUpdateCacheVersion(): Promise<void> {
  if (!CACHE_ENABLED) {
    console.log('[Cache] Disabled (dev); clearing any existing entries')
    await clearAllLspCache()
    return
  }

  const storedVersion = localStorage.getItem(CACHE_STORAGE_KEY)
  if (storedVersion !== WASM_ASSETS_VERSION) {
    console.log(`[Cache] Build version changed: ${storedVersion} -> ${WASM_ASSETS_VERSION}`)
    await clearAllLspCache()
    localStorage.setItem(CACHE_STORAGE_KEY, WASM_ASSETS_VERSION)
  }
}

async function cachedFetch(url: string, cacheName: string): Promise<Response> {
  if (!CACHE_ENABLED) {
    return fetch(url, { cache: 'no-cache' })
  }

  const cache = await caches.open(cacheName)

  const cached = await cache.match(url)
  if (cached) {
    console.log(`[Cache] Hit: ${url}`)
    return cached
  }

  console.log(`[Cache] Miss: ${url}, fetching...`)
  const response = await fetch(url)

  if (response.ok) {
    await cache.put(url, response.clone())
    console.log(`[Cache] Stored: ${url}`)
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
    })
    console.log(`[Cache] Cleared CJO cache: ${CJO_DB_NAME}`)
  }
  catch (e) {
    console.warn(`[Cache] Failed to clear CJO cache:`, e)
  }
}

export async function clearAllLspCache(): Promise<void> {
  await Promise.all([clearWasmCache(), clearCjoCache()])
}

export interface EmscriptenModule {
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
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
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
    request.onsuccess = () => resolve(request.result || null)
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
}

export async function initializeLspServerInWorker(
  callbacks: LspServerCallbacks,
  shouldAbort: () => boolean,
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

  const WasmModule = await import(/* webpackIgnore: true */ /* @vite-ignore */ LSP_WASM_PATH)
  if (shouldAbort())
    throw new Error('aborted')

  let rejectInstantiation!: (error: Error) => void
  const instantiationFailure = new Promise<never>((_resolve, reject) => {
    rejectInstantiation = reject
  })
  const wasmModulePromise = WasmModule.default({
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
        .then(r => r.arrayBuffer())
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

  onLog('Initializing LSP server...')
  wasmMod.initLSP()

  onLog('Loading standard library...')

  let loaded = 0
  let cached = 0
  let downloaded = 0

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

    try {
      const cachedData = db ? await idbGet(db, modulePath) : null

      if (cachedData) {
        wasmMod.FS.writeFile(destPath, cachedData)
        loaded++
        cached++
      }
      else {
        const url = `${LSP_MODULES_PATH}/${CJO_TARGET}/${modulePath}${WASM_ASSETS_VERSION_QS}`
        const response = await fetch(url)
        if (response.ok) {
          const data = new Uint8Array(await response.arrayBuffer())
          wasmMod.FS.writeFile(destPath, data)

          if (db) {
            idbPut(db, modulePath, data)
          }

          loaded++
          downloaded++
        }
      }
    }
    catch (e) {
      onLog(`  [cjo] FAILED: ${modulePath} - ${(e as Error).message}`)
    }
  }))

  db?.close()
  onLog(`Loaded ${loaded}/${CJO_MODULES.length} stdlib modules (${cached} cached, ${downloaded} downloaded)`)
  if (shouldAbort())
    throw new Error('aborted')

  onLog('Starting server loop...')
  wasmMod.startServerLoop()

  return wasmMod
}
