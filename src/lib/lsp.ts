import { HMR_SLOT_KEYS, hmrSlot } from '@/lib/hmr-store'

// Pthread workers spawned by the emscripten module inherit the JS glue's
// query string via `import.meta.url`, so they hit the same cached URL as
// the main thread without extra revalidation round-trips.
const LSP_VERSION = __LSP_VERSION__
const LSP_VERSION_QS = `?v=${LSP_VERSION}`
const LSP_WASM_PATH = `/lsp/LSPServer-wasm.js${LSP_VERSION_QS}`
const LSP_WASM_BINARY_PATH = `/lsp/LSPServer-wasm.wasm${LSP_VERSION_QS}`
const LSP_MODULES_PATH = '/lsp/modules'

// Disable all WASM + CJO caching in dev so a freshly built wasm/cjo is
// picked up without manually clearing site data.
const CACHE_ENABLED = process.env.NODE_ENV !== 'development'

const CACHE_STORAGE_KEY = 'lsp-cache-version'
const WASM_CACHE_NAME_PREFIX = 'wasm-'
const CJO_DB_NAME = 'cjo-cache'
const CJO_STORE_NAME = 'modules'

const wasmCacheName = `${WASM_CACHE_NAME_PREFIX}${LSP_VERSION}`
const WASM_FATAL_RE = /\babort\(|RuntimeError|Uncaught/

async function checkAndUpdateCacheVersion(): Promise<void> {
  if (!CACHE_ENABLED) {
    console.log('[Cache] Disabled (dev); clearing any existing entries')
    await clearAllLspCache()
    return
  }

  const storedVersion = localStorage.getItem(CACHE_STORAGE_KEY)
  if (storedVersion !== LSP_VERSION) {
    console.log(`[Cache] Build version changed: ${storedVersion} -> ${LSP_VERSION}`)
    await clearAllLspCache()
    localStorage.setItem(CACHE_STORAGE_KEY, LSP_VERSION)
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

  const WasmModule = await import(/* webpackIgnore: true */ LSP_WASM_PATH)
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
        const url = `${LSP_MODULES_PATH}/${__CJO_TARGET__}/${modulePath}${LSP_VERSION_QS}`
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

type StatusListener = (status: LspRuntimeStatus) => void

interface LspGlobalState {
  connectionInstance: ConnectionInstance | null
  generationCounter: number
  lifecycleOperation: Promise<void>
  runtimeStatus: LspRuntimeStatus
  listeners: Set<StatusListener>
  autoRestartTimer: ReturnType<typeof setTimeout> | null
}

const STATE = hmrSlot<LspGlobalState>(HMR_SLOT_KEYS.LSP_STATE, () => ({
  connectionInstance: null,
  generationCounter: 0,
  lifecycleOperation: Promise.resolve(),
  runtimeStatus: {
    state: 'stopped',
    origin: 'auto',
    manuallyStopped: false,
    stdlibModulesLoaded: 0,
    stdlibModulesTotal: __CJO_MODULES__.length,
    generation: 0,
    autoRestartAttempts: 0,
  },
  listeners: new Set<StatusListener>(),
  autoRestartTimer: null,
}))

function emitStatus(): void {
  const snapshot: LspRuntimeStatus = { ...STATE.runtimeStatus }
  for (const listener of STATE.listeners) {
    try {
      listener(snapshot)
    }
    catch (e) {
      console.error('[LSP] status listener threw:', e)
    }
  }
}

function setState(patch: Partial<LspRuntimeStatus>): void {
  Object.assign(STATE.runtimeStatus, patch)
  emitStatus()
}

export function subscribeLspStatus(listener: StatusListener): () => void {
  STATE.listeners.add(listener)
  try {
    listener({ ...STATE.runtimeStatus })
  }
  catch (e) {
    console.error('[LSP] status listener threw on subscribe:', e)
  }
  return () => {
    STATE.listeners.delete(listener)
  }
}

function cancelScheduledAutoRestart(): void {
  if (STATE.autoRestartTimer !== null) {
    clearTimeout(STATE.autoRestartTimer)
    STATE.autoRestartTimer = null
  }
}

function scheduleAutoRestart(reason: string): void {
  if (STATE.runtimeStatus.manuallyStopped) {
    return
  }
  if (STATE.runtimeStatus.autoRestartAttempts >= MAX_AUTO_RESTART_ATTEMPTS) {
    console.warn('[LSP] exhausted auto-restart attempts; staying crashed')
    setState({ state: 'crashed', origin: 'auto', lastError: reason })
    return
  }

  const delay = AUTO_RESTART_BACKOFF_MS[
    Math.min(STATE.runtimeStatus.autoRestartAttempts, AUTO_RESTART_BACKOFF_MS.length - 1)
  ]
  console.warn(`[LSP] scheduling auto-restart in ${delay}ms (attempt ${STATE.runtimeStatus.autoRestartAttempts + 1})`)
  setState({ state: 'crashed', origin: 'auto', lastError: reason })

  cancelScheduledAutoRestart()
  STATE.autoRestartTimer = setTimeout(() => {
    STATE.autoRestartTimer = null
    if (STATE.runtimeStatus.manuallyStopped)
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
  if (STATE.connectionInstance !== instance) {
    return
  }
  instance.crashHandled = true
  console.error('[LSP] crash detected:', err)
  const nextAttempt = STATE.runtimeStatus.autoRestartAttempts + 1
  STATE.runtimeStatus.autoRestartAttempts = nextAttempt
  setState({ autoRestartAttempts: nextAttempt })
  scheduleAutoRestart(err.message)
}

function createConnection(origin: LspStateOrigin): ConnectionInstance {
  const { port1: editorPort, port2: serverPort } = runtimeDeps.createMessageChannel()

  STATE.generationCounter += 1
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
    generation: STATE.generationCounter,
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
        stdlibModulesLoaded: STATE.runtimeStatus.stdlibModulesTotal,
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
  const next = STATE.lifecycleOperation.then(operation, operation)
  STATE.lifecycleOperation = next.then(
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
    STATE.runtimeStatus.manuallyStopped = false
    STATE.runtimeStatus.autoRestartAttempts = 0
    cancelScheduledAutoRestart()
    return true
  }
  return !STATE.runtimeStatus.manuallyStopped
}

async function startLspInternal(origin: LspStateOrigin): Promise<void> {
  if (!enterLifecycle(origin))
    return

  if (STATE.connectionInstance
    && (STATE.runtimeStatus.state === 'running' || STATE.runtimeStatus.state === 'starting')) {
    try {
      await STATE.connectionInstance.initPromise
    }
    catch {}
    return
  }

  if (STATE.connectionInstance) {
    const instance = STATE.connectionInstance
    STATE.connectionInstance = null
    setState({ state: 'stopping', origin })
    await disposeConnection(instance)
  }

  STATE.connectionInstance = createConnection(origin)
  try {
    await STATE.connectionInstance.initPromise
  }
  catch {}
}

export async function startLsp(origin: LspStateOrigin = 'auto'): Promise<void> {
  await runLifecycle(() => startLspInternal(origin))
}

async function stopLspInternal(origin: LspStateOrigin): Promise<void> {
  cancelScheduledAutoRestart()
  if (origin === 'manual') {
    STATE.runtimeStatus.manuallyStopped = true
    STATE.runtimeStatus.autoRestartAttempts = 0
  }

  if (!STATE.connectionInstance) {
    setState({ state: 'stopped', origin, lastError: undefined })
    return
  }

  const instance = STATE.connectionInstance
  STATE.connectionInstance = null
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

  if (STATE.connectionInstance) {
    const instance = STATE.connectionInstance
    STATE.connectionInstance = null
    await disposeConnection(instance)
  }

  STATE.connectionInstance = createConnection(origin)
  try {
    await STATE.connectionInstance.initPromise
  }
  catch {}
}

export async function restartLsp(origin: LspStateOrigin = 'auto'): Promise<void> {
  await runLifecycle(() => restartLspInternal(origin))
}

async function clearCacheAndRestartLspInternal(origin: LspStateOrigin): Promise<void> {
  enterLifecycle(origin)

  // Stop first so no in-flight fetches write to caches we're about to wipe.
  if (STATE.connectionInstance) {
    const instance = STATE.connectionInstance
    STATE.connectionInstance = null
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
  return STATE.connectionInstance?.editorPort ?? null
}

/**
 * Returns the editor port for the currently running (or starting) LSP instance.
 * If the LSP is stopped and not manually stopped, starts it first — this
 * preserves the original boot-on-first-use contract used by the Monaco
 * language client factory.
 */
export function getLanguageClientPort(): MessagePort {
  if (!STATE.connectionInstance) {
    if (STATE.runtimeStatus.manuallyStopped) {
      throw new Error('LSP is manually stopped; cannot obtain port')
    }
    void startLsp('auto')
  }
  return STATE.connectionInstance!.editorPort
}

export function getLspStatus(): LspRuntimeStatus {
  return { ...STATE.runtimeStatus }
}

// HMR boundary — combined with the globalThis-backed STATE above, accepting
// here means edits to this file refresh closures in place without tearing
// down the live LSP connection or re-mounting the editor component tree.
import.meta.webpackHot?.accept()
