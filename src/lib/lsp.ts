import { HMR_SLOT_KEYS, hmrSlot } from '@/lib/hmr-store'
import {
  CACHE_STORAGE_KEY,
  CJO_MODULES,
  clearAllLspCache,
} from '@/lib/lsp-server-runtime'

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
  runtimeWorker: Worker
  initPromise: Promise<void>
  rejectInitialization: (error: Error) => void
  aborted: boolean
  crashHandled: boolean
}

interface LspRuntimeDeps {
  createMessageChannel: () => Pick<MessageChannel, 'port1' | 'port2'>
  createRuntimeWorker: () => Worker
}

const MAX_AUTO_RESTART_ATTEMPTS = 4
const AUTO_RESTART_BACKOFF_MS = [1_000, 4_000, 15_000, 60_000]
const runtimeDeps: LspRuntimeDeps = {
  createMessageChannel: () => new MessageChannel(),
  createRuntimeWorker: () => new Worker(
    new URL('../workers/lsp-runtime.worker.ts', import.meta.url),
    { type: 'module', name: 'cangjie-lsp-runtime' },
  ),
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
    stdlibModulesTotal: CJO_MODULES.length,
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
  const runtimeWorker = runtimeDeps.createRuntimeWorker()
  let resolveInitialization!: () => void
  let rejectInitialization!: (error: Error) => void
  const initPromise = new Promise<void>((resolve, reject) => {
    resolveInitialization = resolve
    rejectInitialization = reject
  })

  STATE.generationCounter += 1
  const instance: ConnectionInstance = {
    editorPort,
    runtimeWorker,
    initPromise,
    rejectInitialization,
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

  runtimeWorker.onmessage = (event: MessageEvent<{
    type: 'ready' | 'log' | 'error'
    message?: string
  }>) => {
    if (instance.aborted)
      return
    const message = event.data
    if (message.type === 'log') {
      console.log('[LSP]', message.message)
      return
    }
    if (message.type === 'ready') {
      setState({
        state: 'running',
        stdlibModulesLoaded: STATE.runtimeStatus.stdlibModulesTotal,
        lastError: undefined,
        autoRestartAttempts: 0,
      })
      resolveInitialization()
      return
    }
    const error = new Error(message.message ?? 'LSP runtime worker failed')
    rejectInitialization(error)
    handleCrash(error, instance)
  }
  runtimeWorker.onerror = (event) => {
    if (instance.aborted)
      return
    const error = new Error(event.message || 'LSP runtime worker crashed')
    rejectInitialization(error)
    handleCrash(error, instance)
  }
  runtimeWorker.postMessage({ type: 'start', serverPort }, [serverPort])

  editorPort.start()

  return instance
}

async function disposeConnection(instance: ConnectionInstance): Promise<void> {
  instance.aborted = true
  instance.crashHandled = true
  instance.rejectInitialization(new DOMException(
    'LSP runtime stopped',
    'AbortError',
  ))
  try {
    instance.runtimeWorker.onmessage = null
    instance.runtimeWorker.onerror = null
    instance.runtimeWorker.terminate()
  }
  catch {}
  try {
    instance.editorPort.close()
  }
  catch {}
  await instance.initPromise.catch(() => undefined)
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

interface LspInitializationHandle {
  initialization: Promise<void> | null
}

async function startLspInternal(
  origin: LspStateOrigin,
): Promise<LspInitializationHandle> {
  if (!enterLifecycle(origin))
    return { initialization: null }

  if (STATE.connectionInstance
    && (STATE.runtimeStatus.state === 'running' || STATE.runtimeStatus.state === 'starting')) {
    return { initialization: STATE.connectionInstance.initPromise }
  }

  if (STATE.connectionInstance) {
    const instance = STATE.connectionInstance
    STATE.connectionInstance = null
    setState({ state: 'stopping', origin })
    await disposeConnection(instance)
  }

  STATE.connectionInstance = createConnection(origin)
  return { initialization: STATE.connectionInstance.initPromise }
}

export async function startLsp(origin: LspStateOrigin = 'auto'): Promise<void> {
  const handle = await runLifecycle(() => startLspInternal(origin))
  await handle.initialization?.catch(() => undefined)
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

async function restartLspInternal(
  origin: LspStateOrigin,
): Promise<LspInitializationHandle> {
  if (!enterLifecycle(origin))
    return { initialization: null }

  setState({ state: 'restarting', origin, lastError: undefined })

  if (STATE.connectionInstance) {
    const instance = STATE.connectionInstance
    STATE.connectionInstance = null
    await disposeConnection(instance)
  }

  STATE.connectionInstance = createConnection(origin)
  return { initialization: STATE.connectionInstance.initPromise }
}

export async function restartLsp(origin: LspStateOrigin = 'auto'): Promise<void> {
  const handle = await runLifecycle(() => restartLspInternal(origin))
  await handle.initialization?.catch(() => undefined)
}

async function clearCacheAndRestartLspInternal(
  origin: LspStateOrigin,
): Promise<LspInitializationHandle> {
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
  return startLspInternal(origin)
}

export async function clearCacheAndRestartLsp(origin: LspStateOrigin = 'manual'): Promise<void> {
  const handle = await runLifecycle(() => clearCacheAndRestartLspInternal(origin))
  await handle.initialization?.catch(() => undefined)
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
export async function getLanguageClientPort(): Promise<MessagePort> {
  if (!STATE.connectionInstance) {
    if (STATE.runtimeStatus.manuallyStopped) {
      throw new Error('LSP is manually stopped; cannot obtain port')
    }
    await startLsp('auto')
  }
  const port = STATE.connectionInstance?.editorPort
  if (!port)
    throw new Error('LSP failed to create an editor port')
  return port
}

export function getLspStatus(): LspRuntimeStatus {
  return { ...STATE.runtimeStatus }
}

// HMR boundary — combined with the globalThis-backed STATE above, accepting
// here means edits to this file refresh closures in place without tearing
// down the live LSP connection or re-mounting the editor component tree.
import.meta.webpackHot?.accept()
