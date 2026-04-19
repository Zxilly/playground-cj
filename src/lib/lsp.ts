// TODO: switch back to /lsp/LSPServer-wasm.{js,wasm} once the signature
// mismatch / documentLink crash is diagnosed.
const LSP_WASM_PATH = '/lsp/LSPServer-wasm-debug.js'
const LSP_WASM_BINARY_PATH = '/lsp/LSPServer-wasm-debug.wasm'
const LSP_MODULES_PATH = '/lsp/modules'

// Disable all WASM + CJO caching in dev so a freshly built wasm/cjo is
// picked up without manually clearing site data.
const CACHE_ENABLED = process.env.NODE_ENV !== 'development'

// Cache key is derived from the .wasm file's HTTP metadata so a new build
// auto-invalidates the Cache API + IndexedDB layers without a manual bump.
const CACHE_KEY_FALLBACK = 'lsp-fallback'
const CACHE_STORAGE_KEY = 'lsp-cache-version'
const WASM_CACHE_NAME_PREFIX = 'wasm-'
const CJO_DB_NAME = 'cjo-cache'
const CJO_STORE_NAME = 'modules'

let currentCacheKey: string = CACHE_KEY_FALLBACK
let wasmCacheName: string = `${WASM_CACHE_NAME_PREFIX}${CACHE_KEY_FALLBACK}`

// Prefer ETag, then Last-Modified, then Content-Length — any value that
// changes between builds is sufficient.
async function detectBuildVersion(): Promise<string> {
  try {
    const res = await fetch(LSP_WASM_BINARY_PATH, { method: 'HEAD', cache: 'no-cache' })
    const etag = res.headers.get('etag')
    if (etag)
      return `etag-${etag.replace(/["\s]/g, '').slice(0, 24)}`
    const lastMod = res.headers.get('last-modified')
    if (lastMod)
      return `lm-${Date.parse(lastMod) || lastMod.slice(0, 24)}`
    const len = res.headers.get('content-length')
    if (len)
      return `len-${len}`
  }
  catch (e) {
    console.warn('[Cache] detectBuildVersion HEAD failed, using fallback:', e)
  }
  return CACHE_KEY_FALLBACK
}

async function checkAndUpdateCacheVersion(): Promise<void> {
  if (!CACHE_ENABLED) {
    console.log('[Cache] Disabled (dev); clearing any existing entries')
    await clearAllLspCache()
    return
  }

  const detected = await detectBuildVersion()
  currentCacheKey = detected
  wasmCacheName = `${WASM_CACHE_NAME_PREFIX}${detected}`

  const storedVersion = localStorage.getItem(CACHE_STORAGE_KEY)
  if (storedVersion !== detected) {
    console.log(`[Cache] Build version changed: ${storedVersion} -> ${detected}`)
    await clearAllLspCache()
    localStorage.setItem(CACHE_STORAGE_KEY, detected)
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

// JS glue is not pre-cached — it's dynamically imported with a cache-busting
// query param, so the browser's module cache handles freshness.
async function preloadWasmCache(): Promise<void> {
  try {
    await cachedFetch(LSP_WASM_BINARY_PATH, wasmCacheName)
  }
  catch (e) {
    console.warn(`[Cache] Failed to preload ${LSP_WASM_BINARY_PATH}:`, e)
  }
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

interface EmscriptenModule {
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

interface LspServerCallbacks {
  onMessage: (label: 'Response' | 'Notification', json: object) => void
  onLog: (msg: string) => void
  onError: (err: Error) => void
}

async function initializeLspServer(callbacks: LspServerCallbacks): Promise<EmscriptenModule> {
  const { onMessage, onLog, onError } = callbacks

  await checkAndUpdateCacheVersion()

  onLog('Loading WASM module...')
  await preloadWasmCache()

  // Cache-bust the JS glue in lockstep with the .wasm binary.
  // Directories the stdlib loader will write into. Cangjie's static init
  // (inside the wasm factory) also expects `/cangjie/modules/<target>/` to
  // exist — create everything in preRun so it's ready before main() runs.
  const targetModulesPath = `/cangjie/modules/${__CJO_TARGET__}`
  const moduleDirs = new Set<string>()
  for (const modulePath of __CJO_MODULES__) {
    const idx = modulePath.lastIndexOf('/')
    if (idx > 0) {
      moduleDirs.add(modulePath.slice(0, idx))
    }
  }

  const jsUrl = `${LSP_WASM_PATH}?v=${encodeURIComponent(currentCacheKey)}`
  const WasmModule = await import(/* webpackIgnore: true */ jsUrl)
  const wasmMod: EmscriptenModule = await WasmModule.default({
    print: (text: string) => onLog(`[stdout] ${text}`),
    printErr: (text: string) => onLog(`[stderr] ${text}`),
    preRun: [(mod: EmscriptenModule) => {
      mkdirP(mod.FS, targetModulesPath)
      for (const dir of moduleDirs) {
        mkdirP(mod.FS, `${targetModulesPath}/${dir}`)
      }
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
        .catch(e => onError(new Error(`Failed to instantiate WASM: ${(e as Error).message}`)))
      return {}
    },
  })

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
  // The wasm glue is built with Closure 1, which mangles the
  // `Module.onLSPMessage` property it checks inside EM_JS to a short name
  // (currently `uc`). User code isn't processed by the same closure pass,
  // so setting only `onLSPMessage` doesn't connect. Assign both; if the
  // mangled name changes on a future wasm build, update the fallback.
  wasmMod.onLSPMessage = lspMessageHandler
  ;(wasmMod as unknown as Record<string, unknown>).uc = lspMessageHandler

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
    catch {}
  }

  await Promise.all(__CJO_MODULES__.map(async (modulePath) => {
    const destPath = `${targetModulesPath}/${modulePath}`

    try {
      const cachedData = db ? await idbGet(db, modulePath) : null

      if (cachedData) {
        wasmMod.FS.writeFile(destPath, cachedData)
        loaded++
        cached++
        onLog(`  [cjo] ${destPath} (${cachedData.length} bytes, cached)`)
      }
      else {
        const url = `${LSP_MODULES_PATH}/${__CJO_TARGET__}/${modulePath}`
        const response = await fetch(url)
        if (response.ok) {
          const data = new Uint8Array(await response.arrayBuffer())
          wasmMod.FS.writeFile(destPath, data)

          if (db) {
            idbPut(db, modulePath, data)
          }

          loaded++
          downloaded++
          onLog(`  [cjo] ${destPath} (${data.length} bytes, downloaded)`)
        }
      }
    }
    catch (e) {
      onLog(`  [cjo] FAILED: ${modulePath} - ${(e as Error).message}`)
    }
  }))

  db?.close()
  onLog(`Loaded ${loaded}/${__CJO_MODULES__.length} stdlib modules (${cached} cached, ${downloaded} downloaded)`)

  onLog('Starting server loop...')
  wasmMod.startServerLoop()

  return wasmMod
}

interface ConnectionInstance {
  editorPort: MessagePort
  initPromise: Promise<EmscriptenModule>
  module: EmscriptenModule | null
}

let connectionInstance: ConnectionInstance | null = null

// editorPort (port1) is consumed by monaco-languageclient's
// BrowserMessageReader/Writer; serverPort (port2) bridges to the WASM LSP via
// postMessage ↔ processMessage / onLSPMessage.
function createLanguageClientConnection(): ConnectionInstance {
  const { port1: editorPort, port2: serverPort } = new MessageChannel()

  const instance: ConnectionInstance = { editorPort, initPromise: null!, module: null }

  let wasmModule: EmscriptenModule | null = null

  instance.initPromise = initializeLspServer({
    onMessage: (_label, json) => serverPort.postMessage(json),
    onLog: msg => console.log('[LSP]', msg),
    onError: err => console.error('[LSP Error]', err),
  }).then((module) => {
    wasmModule = module
    instance.module = module
    return module
  })

  serverPort.onmessage = async (event) => {
    if (!wasmModule) {
      await instance.initPromise
    }
    console.log('[LSP Message]', event.data)
    const message = typeof event.data === 'string' ? event.data : JSON.stringify(event.data)
    wasmModule!.processMessage(message)
  }

  serverPort.start()
  editorPort.start()

  return instance
}

export function getLanguageClientPort(): MessagePort {
  if (!connectionInstance) {
    connectionInstance = createLanguageClientConnection()
  }
  return connectionInstance.editorPort
}

export interface LspStatus {
  initialized: boolean
  stdlibModulesLoaded: number
  stdlibModulesTotal: number
}

export function getLspStatus(): LspStatus {
  const initialized = connectionInstance !== null && connectionInstance.module !== null

  return {
    initialized,
    stdlibModulesLoaded: initialized ? __CJO_MODULES__.length : 0,
    stdlibModulesTotal: __CJO_MODULES__.length,
  }
}
