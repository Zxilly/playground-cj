// LSP WASM module paths
const LSP_WASM_PATH = '/lsp/LSPServer-wasm.js'
const LSP_MODULES_PATH = '/lsp/modules'
const TARGET_PATH = 'linux_x86_64_cjnative'

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
  }
}

interface LspServerCallbacks {
  onResponse: (json: object) => void
  onNotification: (json: object) => void
  onLog: (msg: string) => void
  onError: (err: Error) => void
}

/**
 * Initialize the Cangjie LSP WASM module
 */
async function initializeLspServer(callbacks: LspServerCallbacks): Promise<EmscriptenModule> {
  const { onResponse, onNotification, onLog, onError } = callbacks

  onLog('Loading WASM module...')

  // Dynamic import of the WASM module (must remain dynamic as it's loaded at runtime)
  const WasmModule = await import(/* webpackIgnore: true */ LSP_WASM_PATH)
  const module: EmscriptenModule = await WasmModule.default({
    print: (text: string) => onLog(`[stdout] ${text}`),
    printErr: (text: string) => onLog(`[stderr] ${text}`),
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

  // Load standard library modules
  onLog('Loading standard library...')
  const targetModulesPath = `/cangjie/modules/${TARGET_PATH}`
  module.createDirectory(`${targetModulesPath}/std`)

  let loaded = 0
  for (const modulePath of STD_MODULES) {
    const url = `${LSP_MODULES_PATH}/${TARGET_PATH}/${modulePath}`
    try {
      const response = await fetch(url)
      if (response.ok) {
        const buffer = await response.arrayBuffer()
        const data = new Uint8Array(buffer)
        const destPath = `${targetModulesPath}/${modulePath}`

        const dir = destPath.substring(0, destPath.lastIndexOf('/'))
        module.createDirectory(dir)
        module.FS.writeFile(destPath, data)
        loaded++
        onLog(`  [cjo] ${destPath} (${data.length} bytes)`)
      }
    }
    catch (e) {
      onLog(`  [cjo] FAILED: ${url} - ${(e as Error).message}`)
    }
  }
  onLog(`Loaded ${loaded}/${STD_MODULES.length} stdlib modules`)

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
