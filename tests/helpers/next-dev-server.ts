import { spawn, spawnSync } from 'node:child_process'
import type { Buffer } from 'node:buffer'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'

const require = createRequire(import.meta.url)

interface StartedNextDevServer {
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

async function waitForHttp(url: string, getOutput: () => string) {
  const deadline = Date.now() + 90_000
  let lastError: unknown

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: 'manual' })
      if (response.status < 500)
        return
    }
    catch (error) {
      lastError = error
    }

    await new Promise(resolve => setTimeout(resolve, 500))
  }

  throw new Error(`Next dev server did not become ready: ${String(lastError)}\n${getOutput()}`)
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

async function getExistingDevServer(): Promise<StartedNextDevServer | undefined> {
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

export async function startNextDevServer(): Promise<StartedNextDevServer> {
  const existing = await getExistingDevServer()
  if (existing)
    return existing

  const port = await getAvailablePort()
  const nextCli = require.resolve('next/dist/bin/next')
  const child = spawn(process.execPath, [
    nextCli,
    'dev',
    '--webpack',
    '--hostname',
    '127.0.0.1',
    '--port',
    String(port),
  ], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CI: '1',
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
      reject(new Error(`Next dev server exited before readiness with code ${code} signal ${signal}\n${output}`))
    })
  })

  const url = `http://127.0.0.1:${port}`
  await Promise.race([
    waitForHttp(`${url}/zh`, () => output),
    exited,
  ])

  child.removeAllListeners('exit')

  return {
    port,
    url,
    stop: () => stopProcessTree(child),
  }
}
