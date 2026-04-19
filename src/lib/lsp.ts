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
const ETAG_SANITIZE_RE = /["\s]/g
const WASM_FATAL_RE = /\babort\(|RuntimeError|Uncaught/

// Prefer ETag, then Last-Modified, then Content-Length — any value that
// changes between builds is sufficient.
async function detectBuildVersion(): Promise<string> {
  try {
    const res = await fetch(LSP_WASM_BINARY_PATH, { method: 'HEAD', cache: 'no-cache' })
    const etag = res.headers.get('etag')
    if (etag)
      return `etag-${etag.replace(ETAG_SANITIZE_RE, '').slice(0, 24)}`
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

async function initializeLspServer(
  callbacks: LspServerCallbacks,
  shouldAbort: () => boolean,
): Promise<EmscriptenModule> {
  const { onMessage, onLog, onError } = callbacks

  await checkAndUpdateCacheVersion()
  if (shouldAbort())
    throw new Error('aborted')

  onLog('Loading WASM module...')
  await preloadWasmCache()
  if (shouldAbort())
    throw new Error('aborted')

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
  if (shouldAbort())
    throw new Error('aborted')

  const wasmMod: EmscriptenModule = await WasmModule.default({
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
    catch (e) {
      console.warn('[Cache] CJO IndexedDB open failed; modules will be re-downloaded:', e)
    }
  }

  await Promise.all(__CJO_MODULES__.map(async (modulePath) => {
    const destPath = `${targetModulesPath}/${modulePath}`

    try {
      const cachedData = db ? await idbGet(db, modulePath) : null

      if (cachedData) {
        wasmMod.FS.writeFile(destPath, cachedData)
        loaded++
        cached++
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
        }
      }
    }
    catch (e) {
      onLog(`  [cjo] FAILED: ${modulePath} - ${(e as Error).message}`)
    }
  }))

  db?.close()
  onLog(`Loaded ${loaded}/${__CJO_MODULES__.length} stdlib modules (${cached} cached, ${downloaded} downloaded)`)
  if (shouldAbort())
    throw new Error('aborted')

  onLog('Starting server loop...')
  wasmMod.startServerLoop()

  return wasmMod
}

export type LspState = 'stopped'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'crashed'
  | 'restarting'

export type LspStateOrigin = 'manual' | 'auto'

export interface LspRuntimeStatus {
  state: LspState
  origin: LspStateOrigin
  /** Sticky gate — while true, automatic start/restart paths refuse to run. */
  manuallyStopped: boolean
  lastError?: string
  stdlibModulesLoaded: number
  stdlibModulesTotal: number
  /** Increments for each new WASM instance so UIs can detect port replacement. */
  generation: number
  autoRestartAttempts: number
}

interface ConnectionInstance {
  editorPort: MessagePort
  serverPort: MessagePort
  initPromise: Promise<EmscriptenModule>
  module: EmscriptenModule | null
  aborted: boolean
  crashHandled: boolean
}

interface LspRuntimeDeps {
  createMessageChannel: () => Pick<MessageChannel, 'port1' | 'port2'>
  initializeLspServer: (
    callbacks: LspServerCallbacks,
    shouldAbort: () => boolean,
  ) => Promise<EmscriptenModule>
}

const MAX_AUTO_RESTART_ATTEMPTS = 4
const AUTO_RESTART_BACKOFF_MS = [1_000, 4_000, 15_000, 60_000]
const runtimeDeps: LspRuntimeDeps = {
  createMessageChannel: () => new MessageChannel(),
  initializeLspServer,
}

let connectionInstance: ConnectionInstance | null = null
let generationCounter = 0
let lifecycleOperation: Promise<void> = Promise.resolve()

const runtimeStatus: LspRuntimeStatus = {
  state: 'stopped',
  origin: 'auto',
  manuallyStopped: false,
  stdlibModulesLoaded: 0,
  stdlibModulesTotal: __CJO_MODULES__.length,
  generation: 0,
  autoRestartAttempts: 0,
}

type StatusListener = (status: LspRuntimeStatus) => void
const listeners = new Set<StatusListener>()

function emitStatus(): void {
  const snapshot: LspRuntimeStatus = { ...runtimeStatus }
  for (const listener of listeners) {
    try {
      listener(snapshot)
    }
    catch (e) {
      console.error('[LSP] status listener threw:', e)
    }
  }
}

function setState(patch: Partial<LspRuntimeStatus>): void {
  Object.assign(runtimeStatus, patch)
  emitStatus()
}

export function subscribeLspStatus(listener: StatusListener): () => void {
  listeners.add(listener)
  try {
    listener({ ...runtimeStatus })
  }
  catch (e) {
    console.error('[LSP] status listener threw on subscribe:', e)
  }
  return () => {
    listeners.delete(listener)
  }
}

let autoRestartTimer: ReturnType<typeof setTimeout> | null = null

function cancelScheduledAutoRestart(): void {
  if (autoRestartTimer !== null) {
    clearTimeout(autoRestartTimer)
    autoRestartTimer = null
  }
}

function scheduleAutoRestart(reason: string): void {
  if (runtimeStatus.manuallyStopped) {
    return
  }
  if (runtimeStatus.autoRestartAttempts >= MAX_AUTO_RESTART_ATTEMPTS) {
    console.warn('[LSP] exhausted auto-restart attempts; staying crashed')
    setState({ state: 'crashed', origin: 'auto', lastError: reason })
    return
  }

  const delay = AUTO_RESTART_BACKOFF_MS[
    Math.min(runtimeStatus.autoRestartAttempts, AUTO_RESTART_BACKOFF_MS.length - 1)
  ]
  console.warn(`[LSP] scheduling auto-restart in ${delay}ms (attempt ${runtimeStatus.autoRestartAttempts + 1})`)
  setState({ state: 'crashed', origin: 'auto', lastError: reason })

  cancelScheduledAutoRestart()
  autoRestartTimer = setTimeout(() => {
    autoRestartTimer = null
    if (runtimeStatus.manuallyStopped)
      return
    void restartLsp('auto')
  }, delay)
}

function handleCrash(err: Error, instance: ConnectionInstance): void {
  if (instance.crashHandled) {
    return
  }
  // Ignore errors from a superseded instance (e.g. error fires after we've
  // already torn it down for a restart).
  if (connectionInstance !== instance) {
    return
  }
  instance.crashHandled = true
  console.error('[LSP] crash detected:', err)
  const nextAttempt = runtimeStatus.autoRestartAttempts + 1
  runtimeStatus.autoRestartAttempts = nextAttempt
  setState({ autoRestartAttempts: nextAttempt })
  scheduleAutoRestart(err.message)
}

function createConnection(origin: LspStateOrigin): ConnectionInstance {
  const { port1: editorPort, port2: serverPort } = runtimeDeps.createMessageChannel()

  generationCounter += 1
  const instance: ConnectionInstance = {
    editorPort,
    serverPort,
    initPromise: null!,
    module: null,
    aborted: false,
    crashHandled: false,
  }

  setState({
    origin,
    state: 'starting',
    lastError: undefined,
    stdlibModulesLoaded: 0,
    generation: generationCounter,
  })

  instance.initPromise = runtimeDeps.initializeLspServer(
    {
      onMessage: (_label, json) => {
        if (instance.aborted)
          return
        try {
          serverPort.postMessage(json)
        }
        catch (e) {
          console.warn('[LSP] serverPort.postMessage failed:', e)
        }
      },
      onLog: msg => console.log('[LSP]', msg),
      onError: err => handleCrash(err, instance),
    },
    () => instance.aborted,
  )
    .then((module) => {
      if (instance.aborted) {
        throw new Error('aborted')
      }
      instance.module = module
      setState({
        state: 'running',
        stdlibModulesLoaded: runtimeStatus.stdlibModulesTotal,
        lastError: undefined,
        autoRestartAttempts: 0,
      })
      return module
    })
    .catch((err) => {
      if (instance.aborted) {
        throw err
      }
      handleCrash(err as Error, instance)
      throw err
    })

  serverPort.onmessage = async (event) => {
    if (instance.aborted)
      return
    if (!instance.module) {
      try {
        await instance.initPromise
      }
      catch {
        return
      }
    }
    if (instance.aborted || !instance.module)
      return
    const message = typeof event.data === 'string' ? event.data : JSON.stringify(event.data)
    try {
      instance.module.processMessage(message)
    }
    catch (e) {
      handleCrash(e as Error, instance)
    }
  }

  serverPort.start()
  editorPort.start()

  return instance
}

async function disposeConnection(instance: ConnectionInstance): Promise<void> {
  instance.aborted = true
  instance.crashHandled = true
  try {
    instance.serverPort.onmessage = null
    instance.serverPort.close()
  }
  catch {}
  try {
    instance.editorPort.close()
  }
  catch {}
  // Wait for any pending init to settle so we don't race a late success
  // callback that would mutate module/connectionInstance after teardown.
  try {
    await instance.initPromise
  }
  catch {}
  instance.module = null
}

async function runLifecycle<T>(operation: () => Promise<T>): Promise<T> {
  const next = lifecycleOperation.then(operation, operation)
  lifecycleOperation = next.then(
    () => undefined,
    () => undefined,
  )
  return next
}

/**
 * Lifts the `manuallyStopped` gate and cancels pending auto-restart when the
 * caller is explicitly a user action. Returns `false` if an `auto`-origin
 * call should short-circuit because the user has paused the LSP.
 */
function enterLifecycle(origin: LspStateOrigin): boolean {
  if (origin === 'manual') {
    runtimeStatus.manuallyStopped = false
    runtimeStatus.autoRestartAttempts = 0
    cancelScheduledAutoRestart()
    return true
  }
  return !runtimeStatus.manuallyStopped
}

async function startLspInternal(origin: LspStateOrigin): Promise<void> {
  if (!enterLifecycle(origin))
    return

  if (connectionInstance
    && (runtimeStatus.state === 'running' || runtimeStatus.state === 'starting')) {
    try {
      await connectionInstance.initPromise
    }
    catch {}
    return
  }

  if (connectionInstance) {
    const instance = connectionInstance
    connectionInstance = null
    setState({ state: 'stopping', origin })
    await disposeConnection(instance)
  }

  connectionInstance = createConnection(origin)
  try {
    await connectionInstance.initPromise
  }
  catch {}
}

export async function startLsp(origin: LspStateOrigin = 'auto'): Promise<void> {
  await runLifecycle(() => startLspInternal(origin))
}

async function stopLspInternal(origin: LspStateOrigin): Promise<void> {
  cancelScheduledAutoRestart()
  if (origin === 'manual') {
    runtimeStatus.manuallyStopped = true
    runtimeStatus.autoRestartAttempts = 0
  }

  if (!connectionInstance) {
    setState({ state: 'stopped', origin, lastError: undefined })
    return
  }

  const instance = connectionInstance
  connectionInstance = null
  setState({ state: 'stopping', origin })
  await disposeConnection(instance)
  setState({ state: 'stopped', origin, stdlibModulesLoaded: 0 })
}

export async function stopLsp(origin: LspStateOrigin = 'auto'): Promise<void> {
  await runLifecycle(() => stopLspInternal(origin))
}

async function restartLspInternal(origin: LspStateOrigin): Promise<void> {
  if (!enterLifecycle(origin))
    return

  setState({ state: 'restarting', origin, lastError: undefined })

  if (connectionInstance) {
    const instance = connectionInstance
    connectionInstance = null
    await disposeConnection(instance)
  }

  connectionInstance = createConnection(origin)
  try {
    await connectionInstance.initPromise
  }
  catch {}
}

export async function restartLsp(origin: LspStateOrigin = 'auto'): Promise<void> {
  await runLifecycle(() => restartLspInternal(origin))
}

async function clearCacheAndRestartLspInternal(origin: LspStateOrigin): Promise<void> {
  enterLifecycle(origin)

  // Stop first so no in-flight fetches write to caches we're about to wipe.
  if (connectionInstance) {
    const instance = connectionInstance
    connectionInstance = null
    setState({ state: 'stopping', origin })
    await disposeConnection(instance)
  }
  await clearAllLspCache()
  try {
    localStorage.removeItem(CACHE_STORAGE_KEY)
  }
  catch {}
  setState({ state: 'stopped', origin, stdlibModulesLoaded: 0 })
  await startLspInternal(origin)
}

export async function clearCacheAndRestartLsp(origin: LspStateOrigin = 'manual'): Promise<void> {
  await runLifecycle(() => clearCacheAndRestartLspInternal(origin))
}

export function getCurrentEditorPort(): MessagePort | null {
  return connectionInstance?.editorPort ?? null
}

/**
 * Returns the editor port for the currently running (or starting) LSP instance.
 * If the LSP is stopped and not manually stopped, starts it first — this
 * preserves the original boot-on-first-use contract used by the Monaco
 * language client factory.
 */
export function getLanguageClientPort(): MessagePort {
  if (!connectionInstance) {
    if (runtimeStatus.manuallyStopped) {
      throw new Error('LSP is manually stopped; cannot obtain port')
    }
    void startLsp('auto')
  }
  return connectionInstance!.editorPort
}

export function getLspStatus(): LspRuntimeStatus {
  return { ...runtimeStatus }
}
