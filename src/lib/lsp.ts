// LSP WASM module paths
const LSP_WASM_PATH = '/lsp/LSPServer-wasm.js'
const LSP_WASM_BINARY_PATH = '/lsp/LSPServer-wasm.wasm'
const LSP_MODULES_PATH = '/lsp/modules'
const TARGET_PATH = 'linux_x86_64_cjnative'

// Cache configuration
const CACHE_KEY = 'lsp-v2' // Change this to invalidate all caches (WASM + CJO)
const CACHE_STORAGE_KEY = 'lsp-cache-version'
const WASM_CACHE_NAME = `wasm-${CACHE_KEY}`
const WASM_CACHE_PATHS = [LSP_WASM_PATH, LSP_WASM_BINARY_PATH]
const CJO_DB_NAME = 'cjo-cache'
const CJO_STORE_NAME = 'modules'

/**
 * Check if cache version changed and clear if needed
 */
async function checkAndUpdateCacheVersion(): Promise<void> {
  const storedVersion = localStorage.getItem(CACHE_STORAGE_KEY)

  if (storedVersion !== CACHE_KEY) {
    console.log(`[Cache] Version changed: ${storedVersion} -> ${CACHE_KEY}`)
    await clearAllLspCache()
    localStorage.setItem(CACHE_STORAGE_KEY, CACHE_KEY)
  }
}

/**
 * Fetch with Cache API support
 * Tries cache first, falls back to network and caches the response
 */
async function cachedFetch(url: string, cacheName: string): Promise<Response> {
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

/**
 * Preload and cache WASM files
 */
async function preloadWasmCache(): Promise<void> {
  await Promise.all(WASM_CACHE_PATHS.map(async (path) => {
    try {
      await cachedFetch(path, WASM_CACHE_NAME)
    }
    catch (e) {
      console.warn(`[Cache] Failed to preload ${path}:`, e)
    }
  }))
}

/**
 * Clear all WASM caches (current + old versions)
 */
async function clearWasmCache(): Promise<void> {
  const keys = await caches.keys()
  await Promise.all(
    keys.filter(key => key.startsWith('wasm-')).map(async (key) => {
      await caches.delete(key)
      console.log(`[Cache] Cleared WASM cache: ${key}`)
    }),
  )
}

/**
 * Clear CJO modules cache from IndexedDB
 */
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

/**
 * Clear all LSP caches (WASM + CJO modules)
 */
export async function clearAllLspCache(): Promise<void> {
  await Promise.all([clearWasmCache(), clearCjoCache()])
}

// Standard library modules
const STD_MODULES = [
  'std.cjo',
  'std/std.core.cjo',
  'std/std.collection.cjo',
  'std/std.collection.concurrent.cjo',
  'std/std.io.cjo',
  'std/std.fs.cjo',
  'std/std.net.cjo',
  'std/std.sync.cjo',
  'std/std.time.cjo',
  'std/std.math.cjo',
  'std/std.math.numeric.cjo',
  'std/std.random.cjo',
  'std/std.regex.cjo',
  'std/std.convert.cjo',
  'std/std.console.cjo',
  'std/std.process.cjo',
  'std/std.env.cjo',
  'std/std.binary.cjo',
  'std/std.unicode.cjo',
  'std/std.sort.cjo',
  'std/std.reflect.cjo',
  'std/std.ref.cjo',
  'std/std.overflow.cjo',
  'std/std.objectpool.cjo',
  'std/std.runtime.cjo',
  'std/std.ast.cjo',
  'std/std.argopt.cjo',
  'std/std.crypto.cjo',
  'std/std.crypto.cipher.cjo',
  'std/std.crypto.digest.cjo',
  'std/std.database.cjo',
  'std/std.database.sql.cjo',
  'std/std.deriving.cjo',
  'std/std.deriving.api.cjo',
  'std/std.deriving.builtins.cjo',
  'std/std.deriving.impl.cjo',
  'std/std.deriving.resolve.cjo',
  'std/std.posix.cjo',
  'std/std.unittest.cjo',
  'std/std.unittest.common.cjo',
  'std/std.unittest.diff.cjo',
  'std/std.unittest.mock.cjo',
  'std/std.unittest.mock.internal.cjo',
  'std/std.unittest.mock.mockmacro.cjo',
  'std/std.unittest.prop_test.cjo',
  'std/std.unittest.testmacro.cjo',
]

// Emscripten module interface (uses proxy pthread for background processing)
interface EmscriptenModule {
  onLSPMessage: (messageStr: string) => void
  initLSPWithPaths: (cangjiePath: string, cangjieHome: string) => void
  startServerLoop: () => void
  processMessage: (message: string) => void
  FS: {
    mkdir: (path: string) => void
    mkdirTree: (path: string) => void
    writeFile: (path: string, data: Uint8Array) => void
  }
}

/**
 * Open IndexedDB for CJO cache
 */
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

/**
 * Read a single key from an open IndexedDB connection
 */
function idbGet(db: IDBDatabase, key: string): Promise<Uint8Array | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CJO_STORE_NAME, 'readonly')
    const request = tx.objectStore(CJO_STORE_NAME).get(key)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result || null)
  })
}

/**
 * Write a single key to an open IndexedDB connection (fire-and-forget)
 */
function idbPut(db: IDBDatabase, key: string, data: Uint8Array): void {
  try {
    const tx = db.transaction(CJO_STORE_NAME, 'readwrite')
    tx.objectStore(CJO_STORE_NAME).put(data, key)
  }
  catch {
    // Ignore cache write errors
  }
}

interface LspServerCallbacks {
  onMessage: (label: 'Response' | 'Notification', json: object) => void
  onLog: (msg: string) => void
  onError: (err: Error) => void
}

/**
 * Initialize the Cangjie LSP WASM module
 */
async function initializeLspServer(callbacks: LspServerCallbacks): Promise<EmscriptenModule> {
  const { onMessage, onLog, onError } = callbacks

  await checkAndUpdateCacheVersion()

  onLog('Loading WASM module...')

  // Preload WASM files into cache
  await preloadWasmCache()

  // Dynamic import of the WASM module (must remain dynamic as it's loaded at runtime)
  const WasmModule = await import(/* webpackIgnore: true */ LSP_WASM_PATH)
  const wasmMod: EmscriptenModule = await WasmModule.default({
    print: (text: string) => onLog(`[stdout] ${text}`),
    printErr: (text: string) => onLog(`[stderr] ${text}`),
    // Use cached fetch for .wasm binary
    instantiateWasm: async (
      imports: WebAssembly.Imports,
      successCallback: (instance: WebAssembly.Instance, module: WebAssembly.Module) => void,
    ) => {
      try {
        const response = await cachedFetch(LSP_WASM_BINARY_PATH, WASM_CACHE_NAME)
        const bytes = await response.arrayBuffer()
        const result = await WebAssembly.instantiate(bytes, imports)
        successCallback(result.instance, result.module)
        return result.instance.exports
      }
      catch (e) {
        onError(new Error(`Failed to instantiate WASM: ${(e as Error).message}`))
        throw e
      }
    },
  })

  // Set up message callback for LSP responses
  wasmMod.onLSPMessage = (messageStr: string) => {
    try {
      const json = JSON.parse(messageStr)
      const label = (json.method && json.id === undefined) ? 'Notification' : 'Response'
      onMessage(label, json)
    }
    catch (e) {
      onError(new Error(`Failed to parse LSP message: ${(e as Error).message}`))
    }
  }

  // Initialize LSP server
  onLog('Initializing LSP server...')
  wasmMod.initLSPWithPaths('/cangjie', '/cangjie')

  // Create directories for modules using FS API
  const targetModulesPath = `/cangjie/modules/${TARGET_PATH}`
  wasmMod.FS.mkdirTree(`${targetModulesPath}/std`)

  // Load standard library modules with a single DB connection
  onLog('Loading standard library...')

  let loaded = 0
  let cached = 0
  let downloaded = 0

  let db: IDBDatabase | null = null
  try {
    db = await openCjoDatabase()
  }
  catch {
    // Continue without cache
  }

  await Promise.all(STD_MODULES.map(async (modulePath) => {
    const destPath = `${targetModulesPath}/${modulePath}`

    try {
      // Check IndexedDB cache first
      const cachedData = db ? await idbGet(db, modulePath) : null

      if (cachedData) {
        wasmMod.FS.writeFile(destPath, cachedData)
        loaded++
        cached++
        onLog(`  [cjo] ${destPath} (${cachedData.length} bytes, cached)`)
      }
      else {
        const url = `${LSP_MODULES_PATH}/${TARGET_PATH}/${modulePath}`
        const response = await fetch(url)
        if (response.ok) {
          const data = new Uint8Array(await response.arrayBuffer())
          wasmMod.FS.writeFile(destPath, data)

          // Cache to IndexedDB (fire-and-forget)
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
  onLog(`Loaded ${loaded}/${STD_MODULES.length} stdlib modules (${cached} cached, ${downloaded} downloaded)`)

  // Start the background server loop for non-blocking message processing
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

/**
 * Create a MessageChannel-based connection between monaco-languageclient and the LSP server.
 *
 * MessageChannel creates two connected ports:
 * - editorPort: Used by monaco-languageclient (BrowserMessageReader/Writer)
 * - serverPort: Used by LSP server to receive requests and send responses
 *
 * Message flow:
 * 1. Editor sends request via editorPort.postMessage() → arrives at serverPort
 * 2. serverPort.onmessage forwards to WASM LSP server
 * 3. LSP server responds via onLSPMessage callback
 * 4. Response sent via serverPort.postMessage() → arrives at editorPort
 * 5. BrowserMessageReader receives response on editorPort
 */
function createLanguageClientConnection(): ConnectionInstance {
  const { port1: editorPort, port2: serverPort } = new MessageChannel()

  const instance: ConnectionInstance = { editorPort, initPromise: null!, module: null }

  let wasmModule: EmscriptenModule | null = null

  instance.initPromise = initializeLspServer({
    onMessage: (label, json) => {
      console.log(`[LSP ${label}]`, json)
      serverPort.postMessage(json)
    },
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

/**
 * Get the MessagePort for monaco-languageclient to communicate with the LSP server.
 * Creates the connection on first call (singleton pattern).
 */
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

/**
 * Get the current LSP server status
 */
export function getLspStatus(): LspStatus {
  const initialized = connectionInstance !== null && connectionInstance.module !== null

  return {
    initialized,
    stdlibModulesLoaded: initialized ? STD_MODULES.length : 0,
    stdlibModulesTotal: STD_MODULES.length,
  }
}
