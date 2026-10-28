import { spawn, spawnSync } from 'node:child_process'
import type { Buffer } from 'node:buffer'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'

const require = createRequire(import.meta.url)

interface StartedNextTestServer {
  port: number
  url: string
  stop: () => Promise<void>
}

async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()

    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Unable to reserve an available TCP port'))
        return
      }

      const { port } = address
      server.close(() => resolve(port))
    })
  })
}

function appendOutput(output: string, chunk: Buffer): string {
  return (output + chunk.toString()).slice(-8_000)
}

async function waitForHttp(url: string, getOutput: () => string, signal: AbortSignal) {
  const deadline = Date.now() + 90_000
  let lastError: unknown

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.any([signal, AbortSignal.timeout(2_000)]) })
      if (response.status < 500)
        return
    }
    catch (error) {
      lastError = error
    }

    await delay(500, undefined, { signal })
  }

  throw new Error(`Next test server did not become ready: ${String(lastError)}\n${getOutput()}`)
}

const EXISTING_DEV_SERVER_URLS = [
  'http://127.0.0.1:3000',
  'http://localhost:3000',
] as const

type FetchPage = (url: string) => Promise<Response>

export async function findExistingDevServerUrl(fetchPage: FetchPage = fetch): Promise<string | undefined> {
  for (const url of EXISTING_DEV_SERVER_URLS) {
    try {
      const response = await fetchPage(`${url}/zh`)
      const html = await response.text()
      if (response.status < 500 && html.includes('__next'))
        return url
    }
    catch {
      // Try the next loopback hostname before deciding no reusable server exists.
    }
  }
}

async function getExistingDevServer(): Promise<StartedNextTestServer | undefined> {
  const url = await findExistingDevServerUrl()
  if (!url)
    return undefined

  const port = Number(new URL(url).port) || 80
  return {
    port,
    url,
    stop: async () => {},
  }
}

async function stopProcessTree(child: ChildProcessWithoutNullStreams) {
  if (child.exitCode !== null || child.signalCode !== null)
    return

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    })
    return
  }

  child.kill('SIGTERM')
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL')
      resolve()
    }, 5_000)
    child.once('exit', () => {
      clearTimeout(timeout)
      resolve()
    })
  })
}

export async function startNextTestServer(): Promise<StartedNextTestServer> {
  const production = process.env.PLAYGROUND_TEST_MODE === 'production'
  const existing = production ? undefined : await getExistingDevServer()
  if (existing)
    return existing

  const port = await getAvailablePort()
  const nextCli = require.resolve('next/dist/bin/next')
  const child = spawn(process.execPath, [
    nextCli,
    ...(production ? ['start'] : ['dev', '--turbopack']),
    '--hostname',
    '127.0.0.1',
    '--port',
    String(port),
  ], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: production ? 'production' : 'development',
      CI: '1',
      PLAYGROUND_E2E: '1',
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })

  let output = ''
  child.stdout.on('data', chunk => output = appendOutput(output, chunk))
  child.stderr.on('data', chunk => output = appendOutput(output, chunk))

  const exited = new Promise<never>((_, reject) => {
    child.once('exit', (code, signal) => {
      reject(new Error(`Next test server exited before readiness with code ${code} signal ${signal}\n${output}`))
    })
  })

  const url = `http://127.0.0.1:${port}`
  const readiness = new AbortController()
  try {
    await Promise.race([
      waitForHttp(`${url}/zh`, () => output, readiness.signal),
      exited,
    ])
  }
  catch (error) {
    await stopProcessTree(child)
    throw error
  }
  finally {
    readiness.abort()
    child.removeAllListeners('exit')
  }

  return {
    port,
    url,
    stop: () => stopProcessTree(child),
  }
}
