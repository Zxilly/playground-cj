import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MCP_URL, resolveMcpUrl } from './client'

const sdkMocks = vi.hoisted(() => {
  const createClient = vi.fn()
  const createTransport = vi.fn()
  return {
    createClient,
    createTransport,
    Client: vi.fn(class MockClient {
      constructor() {
        Object.assign(this, createClient())
      }
    }),
    StreamableHTTPClientTransport: vi.fn(class MockTransport {
      constructor() {
        Object.assign(this, createTransport())
      }
    }),
  }
})

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: sdkMocks.Client,
}))

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: sdkMocks.StreamableHTTPClientTransport,
}))

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

describe('resolveMcpUrl', () => {
  it('defaults to the upstream MCP url directly', () => {
    // Without a NEXT_PUBLIC_CANGJIE_MCP_URL override the client connects straight
    // to the upstream (which exposes mcp-session-id via CORS).
    expect(MCP_URL).toBe('https://cj-mcp.learningman.top/mcp')
  })

  it('uses the absolute default verbatim, ignoring the origin base', () => {
    expect(resolveMcpUrl('https://playground.example.com').href).toBe(
      'https://cj-mcp.learningman.top/mcp',
    )
  })

  it('ignores the base when MCP_URL is already absolute', () => {
    // `new URL(absolute, base)` ignores the base, so an override is used verbatim.
    expect(new URL('https://mcp.example.com/mcp', 'https://playground.example.com').href).toBe(
      'https://mcp.example.com/mcp',
    )
  })
})

describe('mcp client lifecycle', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    sdkMocks.Client.mockClear()
    sdkMocks.StreamableHTTPClientTransport.mockClear()
    sdkMocks.createClient.mockReset()
    sdkMocks.createTransport.mockReset()
    sdkMocks.createTransport.mockReturnValue({})
  })

  it('closes a timed-out owner before allowing a replacement connection', async () => {
    const deadline = new AbortController()
    const nextDeadline = new AbortController()
    vi.spyOn(AbortSignal, 'timeout')
      .mockReturnValueOnce(deadline.signal)
      .mockReturnValue(nextDeadline.signal)

    const rawConnect = deferred<void>()
    const close = deferred<void>()
    const firstClient = {
      connect: vi.fn(() => rawConnect.promise),
      close: vi.fn(async () => {
        rawConnect.reject(deadline.signal.reason)
        await close.promise
      }),
      listTools: vi.fn(),
    }
    const secondClient = {
      connect: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
      listTools: vi.fn(async () => ({
        tools: [{
          name: 'search_docs',
          description: 'Search Cangjie documentation',
          inputSchema: { type: 'object' },
        }],
      })),
    }
    sdkMocks.createClient
      .mockReturnValueOnce(firstClient)
      .mockReturnValueOnce(secondClient)

    const { listMcpTools } = await import('./client')
    const firstOutcome = listMcpTools().then(
      value => ({ error: null, value }),
      error => ({ error, value: null }),
    )

    await vi.waitFor(() => {
      expect(firstClient.connect).toHaveBeenCalledWith(
        expect.anything(),
        {
          signal: deadline.signal,
          timeout: 10_000,
        },
      )
    })
    deadline.abort(new DOMException('MCP connection timed out', 'TimeoutError'))

    await vi.waitFor(() => {
      expect(firstClient.close).toHaveBeenCalledOnce()
    })
    const joinedOutcome = listMcpTools().then(
      value => ({ error: null, value }),
      error => ({ error, value: null }),
    )
    await Promise.resolve()
    expect(sdkMocks.Client).toHaveBeenCalledTimes(1)

    close.resolve()
    expect((await firstOutcome).error).toBeInstanceOf(DOMException)
    expect((await joinedOutcome).error).toBeInstanceOf(DOMException)
    await firstClient.close.mock.results[0]!.value
    await Promise.resolve()

    await expect(listMcpTools()).resolves.toEqual([{
      name: 'search_docs',
      description: 'Search Cangjie documentation',
      inputSchema: { type: 'object' },
    }])
    expect(sdkMocks.Client).toHaveBeenCalledTimes(2)
  })

  it('keeps the shared connection alive when one caller cancels its wait', async () => {
    const deadline = new AbortController()
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal)
    const rawConnect = deferred<void>()
    const client = {
      connect: vi.fn(() => rawConnect.promise),
      close: vi.fn(async () => {}),
      callTool: vi.fn(),
      listTools: vi.fn(async () => ({
        tools: [{
          name: 'search_docs',
          inputSchema: { type: 'object' },
        }],
      })),
    }
    sdkMocks.createClient.mockReturnValue(client)

    const { callMcpTool, listMcpTools } = await import('./client')
    const caller = new AbortController()
    const cancelledOutcome = callMcpTool(
      'search_docs',
      { query: 'Option' },
      caller.signal,
    ).then(
      value => ({ error: null, value }),
      error => ({ error, value: null }),
    )
    await vi.waitFor(() => {
      expect(client.connect).toHaveBeenCalledOnce()
    })

    caller.abort(new DOMException('Teacher turn cancelled', 'AbortError'))

    expect((await cancelledOutcome).error).toMatchObject({
      name: 'AbortError',
    })
    expect(client.close).not.toHaveBeenCalled()
    rawConnect.resolve()

    await expect(listMcpTools()).resolves.toEqual([{
      name: 'search_docs',
      description: undefined,
      inputSchema: { type: 'object' },
    }])
    expect(sdkMocks.Client).toHaveBeenCalledOnce()
    expect(client.callTool).not.toHaveBeenCalled()
  })

  it('does not accumulate clients while a timed-out raw connection ignores close', async () => {
    const deadline = new AbortController()
    const nextDeadline = new AbortController()
    vi.spyOn(AbortSignal, 'timeout')
      .mockReturnValueOnce(deadline.signal)
      .mockReturnValue(nextDeadline.signal)
    const rawConnect = deferred<void>()
    const firstClient = {
      connect: vi.fn(() => rawConnect.promise),
      close: vi.fn(async () => {}),
      listTools: vi.fn(),
    }
    const secondClient = {
      connect: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
      listTools: vi.fn(async () => ({ tools: [] })),
    }
    sdkMocks.createClient
      .mockReturnValueOnce(firstClient)
      .mockReturnValueOnce(secondClient)

    const { listMcpTools } = await import('./client')
    const initialOutcome = listMcpTools().catch(error => error)
    deadline.abort(new DOMException('MCP connection timed out', 'TimeoutError'))

    expect(await initialOutcome).toMatchObject({ name: 'TimeoutError' })
    await vi.waitFor(() => {
      expect(firstClient.close).toHaveBeenCalledOnce()
    })
    const retryErrors = await Promise.all(
      Array.from({ length: 5 }, () => listMcpTools().catch(error => error)),
    )
    expect(retryErrors).toEqual(
      Array.from({ length: 5 }, () => expect.objectContaining({
        name: 'TimeoutError',
      })),
    )
    expect(sdkMocks.Client).toHaveBeenCalledTimes(1)

    rawConnect.resolve()
    await rawConnect.promise
    await firstClient.close.mock.results[0]!.value
    await Promise.resolve()
    await Promise.resolve()

    await expect(listMcpTools()).resolves.toEqual([])
    expect(sdkMocks.Client).toHaveBeenCalledTimes(2)
  })
})
