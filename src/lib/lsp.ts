// LSP WASM module paths
const LSP_WASM_PATH = '/lsp/LSPServer-wasm.js'
const LSP_WASM_BINARY_PATH = '/lsp/LSPServer-wasm.wasm'
const LSP_MODULES_PATH = '/lsp/modules'
const TARGET_PATH = 'linux_x86_64_cjnative'

// Cache configuration
const CACHE_KEY = 'lsp-v1' // Change this to invalidate all caches (WASM + CJO)
const CACHE_STORAGE_KEY = 'lsp-cache-version'
const WASM_CACHE_NAME = `wasm-${CACHE_KEY}`
const WASM_CACHE_PATHS = [LSP_WASM_PATH, LSP_WASM_BINARY_PATH]

/**
 * Check if cache version changed and clear if needed
 */
async function checkAndUpdateCacheVersion(): Promise<boolean> {
  const storedVersion = localStorage.getItem(CACHE_STORAGE_KEY)

  if (storedVersion !== CACHE_KEY) {
    console.log(`[Cache] Version changed: ${storedVersion} -> ${CACHE_KEY}`)
    await clearAllLspCache()
    localStorage.setItem(CACHE_STORAGE_KEY, CACHE_KEY)
    return true // Cache was cleared
  }

  return false // No change
}

/**
 * Fetch with Cache API support
 * Tries cache first, falls back to network and caches the response
 */
async function cachedFetch(url: string, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName)

  // Try cache first
  const cached = await cache.match(url)
  if (cached) {
    console.log(`[Cache] Hit: ${url}`)
    return cached
  }

  // Fetch from network
  console.log(`[Cache] Miss: ${url}, fetching...`)
  const response = await fetch(url)

  if (response.ok) {
    // Cache the response (clone because response can only be consumed once)
    await cache.put(url, response.clone())
    console.log(`[Cache] Stored: ${url}`)
  }

  return response
}

/**
 * Preload and cache WASM files
 */
async function preloadWasmCache(): Promise<void> {
  const cache = await caches.open(WASM_CACHE_NAME)

  for (const path of WASM_CACHE_PATHS) {
    const cached = await cache.match(path)
    if (!cached) {
      console.log(`[Cache] Preloading: ${path}`)
      try {
        const response = await fetch(path)
        if (response.ok) {
          await cache.put(path, response)
          console.log(`[Cache] Preloaded: ${path}`)
        }
      }
      catch (e) {
        console.warn(`[Cache] Failed to preload ${path}:`, e)
      }
    }
  }
}

/**
 * Clear WASM cache
 */
async function clearWasmCache(): Promise<void> {
  // Clear current version cache
  const deleted = await caches.delete(WASM_CACHE_NAME)
  console.log(`[Cache] Cleared WASM: ${WASM_CACHE_NAME}`, deleted)

  // Also try to clear old versioned caches
  const keys = await caches.keys()
  for (const key of keys) {
    if (key.startsWith('wasm-lsp-')) {
      await caches.delete(key)
      console.log(`[Cache] Cleared old WASM cache: ${key}`)
    }
  }
}

/**
 * Clear IDBFS (CJO modules) cache
 */
async function clearIdbfsCache(): Promise<void> {
  const dbName = `/cangjie/modules/${TARGET_PATH}`
  try {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
    console.log(`[Cache] Cleared IDBFS: ${dbName}`)
  }
  catch (e) {
    console.warn(`[Cache] Failed to clear IDBFS:`, e)
  }
}

/**
 * Clear all LSP caches (WASM + IDBFS modules)
 */
export async function clearAllLspCache(): Promise<void> {
  await clearWasmCache()
  await clearIdbfsCache()
}

/**
 * Get current cache key/version
 */
export function getCacheKey(): string {
  return CACHE_KEY
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
  createDirectory: (path: string) => void
  processMessage: (message: string) => void
  FS: {
    writeFile: (path: string, data: Uint8Array) => void
    stat: (path: string) => { size: number }
    mkdir: (path: string) => void
    mount: (type: unknown, opts: object, mountpoint: string) => void
    syncfs: (populate: boolean, callback: (err?: Error) => void) => void
  }
  IDBFS: unknown
}

interface LspServerCallbacks {
  onResponse: (json: object) => void
  onNotification: (json: object) => void
  onLog: (msg: string) => void
  onError: (err: Error) => void
}

/**
 * Check if a file exists in the filesystem
 */
function fileExists(module: EmscriptenModule, path: string): boolean {
  try {
    module.FS.stat(path)
    return true
  }
  catch {
    return false
  }
}

/**
 * Sync filesystem with IndexedDB (populate=true to load from IDB)
 */
function syncFS(module: EmscriptenModule, populate: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    module.FS.syncfs(populate, (err) => {
      if (err) {
        reject(err)
      }
      else {
        resolve()
      }
    })
  })
}

/**
 * Initialize the Cangjie LSP WASM module
 */
async function initializeLspServer(callbacks: LspServerCallbacks): Promise<EmscriptenModule> {
  const { onResponse, onNotification, onLog, onError } = callbacks

  // Check cache version and clear if changed
  const cacheCleared = await checkAndUpdateCacheVersion()
  if (cacheCleared) {
    onLog(`Cache version updated to ${CACHE_KEY}, cleared old caches`)
  }

  onLog('Loading WASM module...')

  // Preload WASM files into cache
  await preloadWasmCache()

  // Dynamic import of the WASM module (must remain dynamic as it's loaded at runtime)
  const WasmModule = await import(/* webpackIgnore: true */ LSP_WASM_PATH)
  const module: EmscriptenModule = await WasmModule.default({
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
  module.onLSPMessage = (messageStr: string) => {
    try {
      const json = JSON.parse(messageStr)
      if (json.id !== undefined) {
        onResponse(json)
      }
      else if (json.method) {
        onNotification(json)
      }
      else {
        onResponse(json)
      }
    }
    catch (e) {
      onError(new Error(`Failed to parse LSP message: ${(e as Error).message}`))
    }
  }

  // Initialize LSP server
  onLog('Initializing LSP server...')
  module.initLSPWithPaths('/cangjie', '/cangjie')

  // Mount IDBFS to modules path with autoPersist for automatic caching
  const targetModulesPath = `/cangjie/modules/${TARGET_PATH}`
  module.createDirectory(`${targetModulesPath}/std`)

  onLog('Mounting IDBFS for module cache...')
  try {
    module.FS.mount(module.IDBFS, { autoPersist: true }, targetModulesPath)
    // Load cached files from IndexedDB
    await syncFS(module, true)
    onLog('IDBFS mounted with autoPersist')
  }
  catch (e) {
    onLog(`IDBFS mount failed: ${(e as Error).message}`)
  }

  // Ensure std subdirectory exists after loading from IDBFS
  try {
    module.FS.mkdir(`${targetModulesPath}/std`)
  }
  catch { /* ignore if exists */ }

  // Load standard library modules
  onLog('Loading standard library...')

  let loaded = 0
  let cached = 0
  let downloaded = 0

  for (const modulePath of STD_MODULES) {
    const destPath = `${targetModulesPath}/${modulePath}`

    try {
      // Check if file already exists (cached in IDBFS)
      if (fileExists(module, destPath)) {
        const stat = module.FS.stat(destPath)
        loaded++
        cached++
        onLog(`  [cjo] ${destPath} (${stat.size} bytes, cached)`)
      }
      else {
        // Download and write (autoPersist will save to IndexedDB)
        const url = `${LSP_MODULES_PATH}/${TARGET_PATH}/${modulePath}`
        const response = await fetch(url)
        if (response.ok) {
          const buffer = await response.arrayBuffer()
          const data = new Uint8Array(buffer)

          // Ensure directory exists
          const dir = destPath.substring(0, destPath.lastIndexOf('/'))
          try {
            module.FS.mkdir(dir)
          }
          catch { /* ignore if exists */ }

          module.FS.writeFile(destPath, data)
          loaded++
          downloaded++
          onLog(`  [cjo] ${destPath} (${data.length} bytes, downloaded)`)
        }
      }
    }
    catch (e) {
      onLog(`  [cjo] FAILED: ${modulePath} - ${(e as Error).message}`)
    }
  }

  onLog(`Loaded ${loaded}/${STD_MODULES.length} stdlib modules (${cached} cached, ${downloaded} downloaded)`)

  // Start the background server loop for non-blocking message processing
  onLog('Starting server loop...')
  module.startServerLoop()

  return module
}

// Connection instance (singleton)
let connectionInstance: {
  editorPort: MessagePort
  initPromise: Promise<EmscriptenModule>
  module: EmscriptenModule | null
} | null = null

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
function createLanguageClientConnection() {
  const channel = new MessageChannel()
  const editorPort = channel.port1 // For monaco-languageclient
  const serverPort = channel.port2 // For LSP server

  let wasmModule: EmscriptenModule | null = null

  const result: {
    editorPort: MessagePort
    initPromise: Promise<EmscriptenModule>
    module: EmscriptenModule | null
  } = {
    editorPort,
    initPromise: null!,
    module: null,
  }

  result.initPromise = initializeLspServer({
    onResponse: (json) => {
      console.log('[LSP Response]', json)
      serverPort.postMessage(json)
    },
    onNotification: (json) => {
      console.log('[LSP Notification]', json)
      serverPort.postMessage(json)
    },
    onLog: msg => console.log('[LSP]', msg),
    onError: err => console.error('[LSP Error]', err),
  }).then((module) => {
    wasmModule = module
    result.module = module
    return module
  })

  // Handle incoming requests from editor
  serverPort.onmessage = async (event) => {
    if (!wasmModule) {
      await result.initPromise
    }
    console.log('[LSP Message]', event.data)
    const message = typeof event.data === 'string' ? event.data : JSON.stringify(event.data)
    wasmModule!.processMessage(message)
  }

  // Start both ports to enable message passing
  serverPort.start()
  editorPort.start()

  return result
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
  loading: boolean
  stdlibModulesLoaded: number
  stdlibModulesTotal: number
}

/**
 * Get the current LSP server status
 */
export function getLspStatus(): LspStatus {
  if (!connectionInstance) {
    return {
      initialized: false,
      loading: false,
      stdlibModulesLoaded: 0,
      stdlibModulesTotal: STD_MODULES.length,
    }
  }

  const isInitialized = connectionInstance.module !== null

  return {
    initialized: isInitialized,
    loading: !isInitialized,
    stdlibModulesLoaded: isInitialized ? STD_MODULES.length : 0,
    stdlibModulesTotal: STD_MODULES.length,
  }
}

/**
 * Wait for LSP to be initialized
 */
export async function waitForLspReady(): Promise<void> {
  if (!connectionInstance) {
    return
  }
  await connectionInstance.initPromise
}
