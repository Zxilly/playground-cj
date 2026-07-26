import { describe, expect, it, vi } from 'vitest'
import { createSharedGatewayBulkhead } from './shared-gateway-bulkhead'
import {
  createSharedModelGateway as createGateway,
} from './shared-model-gateway'
import type {
  SharedModelGatewayDependencies,
} from './shared-model-gateway'

function createSharedModelGateway(
  dependencies:
    & Omit<SharedModelGatewayDependencies, 'tryAcquireRequestSlot'>
    & Partial<Pick<SharedModelGatewayDependencies, 'tryAcquireRequestSlot'>>,
) {
  const fallbackBulkhead = createSharedGatewayBulkhead(32)
  return createGateway({
    ...dependencies,
    tryAcquireRequestSlot:
      dependencies.tryAcquireRequestSlot ?? fallbackBulkhead.tryAcquire,
  })
}

function request(body: unknown, init: RequestInit = {}): Request {
  return new Request('https://playground.test/api/ai-gateway/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    ...init,
  })
}

function completion(content = 'OK'): Record<string, unknown> {
  return {
    id: 'completion-1',
    object: 'chat.completion',
    created: 1,
    model: 'server-model',
    choices: [{
      index: 0,
      finish_reason: 'stop',
      message: { role: 'assistant', content },
    }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  }
}

function completionResponse(content = 'OK'): Response {
  return new Response(JSON.stringify(completion(content)), {
    headers: { 'content-type': 'application/json' },
  })
}

describe('shared model gateway', () => {
  it('keeps the shared credential server-side and enforces the configured model', async () => {
    const upstreamFetch = vi.fn(async (
      _url: string | URL | Request,
      _options?: RequestInit,
    ) => new Response(JSON.stringify({
      id: 'completion-1',
      object: 'chat.completion',
      created: 1,
      model: 'server-model',
      choices: [{
        index: 0,
        finish_reason: 'stop',
        message: { role: 'assistant', content: 'OK' },
      }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }), {
      headers: {
        'content-type': 'application/json',
        'x-upstream-secret': 'do-not-forward',
      },
    }))
    const acquireCredential = vi.fn(async (identity: string) => ({
      apiKey: `secret-for-${identity}`,
    }))
    const gateway = createSharedModelGateway({
      resolveIdentity: () => 'identity-1',
      consumeRequestPermit: async () => true,
      acquireCredential,
      fetch: upstreamFetch,
      upstreamBaseURL: 'https://upstream.test/v1',
      model: 'server-model',
      timeoutMs: 1_000,
    })

    const response = await gateway(request({
      model: 'attacker-selected-model',
      messages: [{ role: 'user', content: 'hello' }],
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-upstream-secret')).toBeNull()
    const responseText = await response.clone().text()
    expect(await response.json()).toMatchObject({ model: 'server-model' })

    const [url, options] = upstreamFetch.mock.calls[0]!
    expect(url).toBe('https://upstream.test/v1/chat/completions')
    expect(options?.headers).toEqual({
      'Authorization': 'Bearer secret-for-identity-1',
      'Content-Type': 'application/json',
    })
    expect(JSON.parse(options?.body as string)).toMatchObject({
      model: 'server-model',
      max_tokens: 4096,
      messages: [{ role: 'user', content: 'hello' }],
    })
    expect(acquireCredential).toHaveBeenCalledWith('identity-1', expect.any(AbortSignal))
    expect(responseText).not.toContain('secret-for-identity-1')
  })

  it('validates a fragmented JSON completion without corrupting split UTF-8', async () => {
    const payload = JSON.stringify(completion('你好'))
    const bytes = new TextEncoder().encode(payload)
    const splitAt = bytes.indexOf(0xE4) + 1
    const gateway = createSharedModelGateway({
      resolveIdentity: () => 'identity-1',
      consumeRequestPermit: async () => true,
      acquireCredential: async () => ({ apiKey: 'server-secret' }),
      fetch: async () => new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(bytes.slice(0, splitAt))
            controller.enqueue(bytes.slice(splitAt))
            controller.close()
          },
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
      upstreamBaseURL: 'https://upstream.test/v1',
      model: 'server-model',
      timeoutMs: 1_000,
    })

    const response = await gateway(request({
      model: 'client-model',
      messages: [{ role: 'user', content: 'hello' }],
    }))

    expect(await response.text()).toBe(payload)
  })

  it('rejects unknown request fields before acquiring a shared credential', async () => {
    const acquireCredential = vi.fn(async () => ({ apiKey: 'secret' }))
    const upstreamFetch = vi.fn()
    const gateway = createSharedModelGateway({
      resolveIdentity: () => 'identity-1',
      consumeRequestPermit: async () => true,
      acquireCredential,
      fetch: upstreamFetch,
      upstreamBaseURL: 'https://upstream.test/v1',
      model: 'server-model',
      timeoutMs: 1_000,
    })

    const response = await gateway(request({
      model: 'client-model',
      messages: [{ role: 'user', content: 'hello' }],
      arbitrary_provider_escape_hatch: { url: 'https://attacker.test' },
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: {
        code: 'invalid_request',
        message: 'Request does not match the chat completion schema.',
        type: 'invalid_request',
      },
    })
    expect(acquireCredential).not.toHaveBeenCalled()
    expect(upstreamFetch).not.toHaveBeenCalled()
  })

  it('sanitizes upstream errors instead of forwarding their body or headers', async () => {
    const gateway = createSharedModelGateway({
      resolveIdentity: () => 'identity-1',
      consumeRequestPermit: async () => true,
      acquireCredential: async () => ({ apiKey: 'server-secret' }),
      fetch: async () => new Response(JSON.stringify({
        error: 'debug details containing server-secret',
      }), {
        status: 500,
        headers: {
          'content-type': 'application/json',
          'x-debug-token': 'server-secret',
        },
      }),
      upstreamBaseURL: 'https://upstream.test/v1',
      model: 'server-model',
      timeoutMs: 1_000,
    })

    const response = await gateway(request({
      model: 'client-model',
      messages: [{ role: 'user', content: 'hello' }],
    }))
    const text = await response.text()

    expect(response.status).toBe(502)
    expect(response.headers.get('x-debug-token')).toBeNull()
    expect(text).toContain('upstream_unavailable')
    expect(text).not.toContain('server-secret')
    expect(text).not.toContain('debug details')
  })

  it('aborts an upstream request when the server timeout elapses', async () => {
    const upstreamFetch = vi.fn((_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
      }))
    const gateway = createSharedModelGateway({
      resolveIdentity: () => 'identity-1',
      consumeRequestPermit: async () => true,
      acquireCredential: async () => ({ apiKey: 'server-secret' }),
      fetch: upstreamFetch as typeof fetch,
      upstreamBaseURL: 'https://upstream.test/v1',
      model: 'server-model',
      timeoutMs: 5,
    })

    const response = await gateway(request({
      model: 'client-model',
      messages: [{ role: 'user', content: 'hello' }],
    }))

    expect(response.status).toBe(504)
    expect(await response.json()).toMatchObject({
      error: { code: 'upstream_timeout' },
    })
    expect(upstreamFetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
  })

  it('keeps the slot when a timed-out fetch remains unsettled', async () => {
    const bulkhead = createSharedGatewayBulkhead(1)
    const upstreamFetch = vi.fn(() => new Promise<Response>(() => {}))
    const gateway = createSharedModelGateway({
      resolveIdentity: () => 'identity-1',
      consumeRequestPermit: async () => true,
      acquireCredential: async () => ({ apiKey: 'server-secret' }),
      fetch: upstreamFetch as typeof fetch,
      upstreamBaseURL: 'https://upstream.test/v1',
      model: 'server-model',
      timeoutMs: 10,
      tryAcquireRequestSlot: bulkhead.tryAcquire,
    })
    const body = {
      model: 'client-model',
      messages: [{ role: 'user', content: 'hello' }],
    }

    const timedOut = await gateway(request(body))
    expect(timedOut.status).toBe(504)

    const blocked = await gateway(request(body))
    expect(blocked.status).toBe(503)
    expect(upstreamFetch).toHaveBeenCalledOnce()
  })

  it('keeps the slot until a late upstream response body finishes cancelling', async () => {
    const bulkhead = createSharedGatewayBulkhead(1)
    let resolveLateResponse: ((response: Response) => void) | undefined
    let settleCancellation: (() => void) | undefined
    const cancellation = new Promise<void>((resolve) => {
      settleCancellation = resolve
    })
    const cancelLateBody = vi.fn(() => cancellation)
    const upstreamFetch = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => {
        resolveLateResponse = resolve
      }))
      .mockResolvedValueOnce(completionResponse())
    const gateway = createSharedModelGateway({
      resolveIdentity: () => 'identity-1',
      consumeRequestPermit: async () => true,
      acquireCredential: async () => ({ apiKey: 'server-secret' }),
      fetch: upstreamFetch,
      upstreamBaseURL: 'https://upstream.test/v1',
      model: 'server-model',
      timeoutMs: 10,
      tryAcquireRequestSlot: bulkhead.tryAcquire,
    })
    const body = {
      model: 'client-model',
      messages: [{ role: 'user', content: 'hello' }],
    }

    await expect(gateway(request(body))).resolves.toMatchObject({ status: 504 })
    await expect(gateway(request(body))).resolves.toMatchObject({ status: 503 })

    resolveLateResponse?.(new Response(
      new ReadableStream<Uint8Array>({ cancel: cancelLateBody }),
      { headers: { 'content-type': 'application/json' } },
    ))
    await vi.waitFor(() => expect(cancelLateBody).toHaveBeenCalledOnce())

    await expect(gateway(request(body))).resolves.toMatchObject({ status: 503 })
    expect(upstreamFetch).toHaveBeenCalledOnce()

    settleCancellation?.()
    await cancellation

    let admitted: Response | undefined
    await vi.waitFor(async () => {
      admitted = await gateway(request(body))
      expect(admitted.status).toBe(200)
    })
    await admitted?.body?.cancel()
  })

  it('applies the same request deadline while reading a slow request body', async () => {
    const acquireCredential = vi.fn()
    const cancel = vi.fn()
    const gateway = createSharedModelGateway({
      resolveIdentity: () => 'identity-1',
      consumeRequestPermit: async () => true,
      acquireCredential,
      fetch: vi.fn(),
      upstreamBaseURL: 'https://upstream.test/v1',
      model: 'server-model',
      timeoutMs: 5,
    })
    const slowRequest = new Request(
      'https://playground.test/api/ai-gateway/v1/chat/completions',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: new ReadableStream<Uint8Array>({ cancel }),
        duplex: 'half',
      } as RequestInit & { duplex: 'half' },
    )

    const response = await gateway(slowRequest)

    expect(response.status).toBe(504)
    expect(await response.json()).toMatchObject({
      error: { code: 'upstream_timeout' },
    })
    expect(cancel).toHaveBeenCalledOnce()
    expect(acquireCredential).not.toHaveBeenCalled()
  })

  it('charges distributed admission before reading a slow request body', async () => {
    const bulkhead = createSharedGatewayBulkhead(1)
    const consumeRequestPermit = vi.fn(async () => true)
    const gateway = createSharedModelGateway({
      resolveIdentity: () => 'identity-1',
      consumeRequestPermit,
      acquireCredential: async () => ({ apiKey: 'server-secret' }),
      fetch: async () => completionResponse(),
      upstreamBaseURL: 'https://upstream.test/v1',
      model: 'server-model',
      timeoutMs: 30,
      tryAcquireRequestSlot: bulkhead.tryAcquire,
    })
    const slowRequest = new Request(
      'https://playground.test/api/ai-gateway/v1/chat/completions',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: new ReadableStream<Uint8Array>(),
        duplex: 'half',
      } as RequestInit & { duplex: 'half' },
    )
    const slowResponse = gateway(slowRequest)

    const rejected = await gateway(request({
      model: 'client-model',
      messages: [{ role: 'user', content: 'hello' }],
    }))

    expect(rejected.status).toBe(503)
    expect(consumeRequestPermit).toHaveBeenCalledOnce()
    await expect(slowResponse).resolves.toMatchObject({ status: 504 })

    const admitted = await gateway(request({
      model: 'client-model',
      messages: [{ role: 'user', content: 'hello' }],
    }))
    expect(admitted.status).toBe(200)
    expect(consumeRequestPermit).toHaveBeenCalledTimes(2)
    await admitted.body?.cancel()
  })

  it('keeps the process slot when a timed-out rate limiter remains unsettled', async () => {
    const bulkhead = createSharedGatewayBulkhead(1)
    const consumeRequestPermit = vi.fn()
      .mockImplementationOnce(() => new Promise<boolean>(() => {}))
      .mockResolvedValue(true)
    const gateway = createSharedModelGateway({
      resolveIdentity: () => 'identity-1',
      consumeRequestPermit,
      acquireCredential: async () => ({ apiKey: 'server-secret' }),
      fetch: async () => completionResponse(),
      upstreamBaseURL: 'https://upstream.test/v1',
      model: 'server-model',
      timeoutMs: 10,
      tryAcquireRequestSlot: bulkhead.tryAcquire,
    })
    const body = {
      model: 'client-model',
      messages: [{ role: 'user', content: 'hello' }],
    }

    const timedOut = await gateway(request(body))
    expect(timedOut.status).toBe(504)
    expect(consumeRequestPermit.mock.calls[0]?.[1]).toEqual(expect.any(AbortSignal))

    const rejected = await gateway(request(body))
    expect(rejected.status).toBe(503)
    expect(consumeRequestPermit).toHaveBeenCalledOnce()
  })

  it('releases a timed-out ownership handoff only after the dependency settles', async () => {
    const bulkhead = createSharedGatewayBulkhead(1)
    let settlePermit: (() => void) | undefined
    const consumeRequestPermit = vi.fn()
      .mockImplementationOnce(() => new Promise<boolean>((resolve) => {
        settlePermit = () => resolve(true)
      }))
      .mockResolvedValue(true)
    const gateway = createSharedModelGateway({
      resolveIdentity: () => 'identity-1',
      consumeRequestPermit,
      acquireCredential: async () => ({ apiKey: 'server-secret' }),
      fetch: async () => completionResponse(),
      upstreamBaseURL: 'https://upstream.test/v1',
      model: 'server-model',
      timeoutMs: 10,
      tryAcquireRequestSlot: bulkhead.tryAcquire,
    })
    const body = {
      model: 'client-model',
      messages: [{ role: 'user', content: 'hello' }],
    }

    await expect(gateway(request(body))).resolves.toMatchObject({ status: 504 })
    await expect(gateway(request(body))).resolves.toMatchObject({ status: 503 })

    settlePermit?.()
    await Promise.resolve()

    const admitted = await gateway(request(body))
    expect(admitted.status).toBe(200)
    await admitted.body?.cancel()
  })

  it('keeps the process slot when a timed-out credential broker remains unsettled', async () => {
    const bulkhead = createSharedGatewayBulkhead(1)
    const acquireCredential = vi.fn()
      .mockImplementationOnce(() => new Promise<{ apiKey: string }>(() => {}))
      .mockResolvedValue({ apiKey: 'server-secret' })
    const gateway = createSharedModelGateway({
      resolveIdentity: () => 'identity-1',
      consumeRequestPermit: async () => true,
      acquireCredential,
      fetch: async () => completionResponse(),
      upstreamBaseURL: 'https://upstream.test/v1',
      model: 'server-model',
      timeoutMs: 10,
      tryAcquireRequestSlot: bulkhead.tryAcquire,
    })
    const body = {
      model: 'client-model',
      messages: [{ role: 'user', content: 'hello' }],
    }

    const timedOut = await gateway(request(body))
    expect(timedOut.status).toBe(504)

    const rejected = await gateway(request(body))
    expect(rejected.status).toBe(503)
    expect(acquireCredential).toHaveBeenCalledOnce()
  })

  it('keeps the slot when upstream read and cancellation remain unsettled', async () => {
    const bulkhead = createSharedGatewayBulkhead(1)
    const hanging = new Promise<void>(() => {})
    const upstreamFetch = vi.fn()
      .mockResolvedValueOnce(new Response(
        new ReadableStream<Uint8Array>({
          pull: () => hanging,
          cancel: () => hanging,
        }),
        { headers: { 'content-type': 'application/json' } },
      ))
      .mockResolvedValueOnce(completionResponse())
    const gateway = createSharedModelGateway({
      resolveIdentity: () => 'identity-1',
      consumeRequestPermit: async () => true,
      acquireCredential: async () => ({ apiKey: 'server-secret' }),
      fetch: upstreamFetch,
      upstreamBaseURL: 'https://upstream.test/v1',
      model: 'server-model',
      timeoutMs: 10,
      tryAcquireRequestSlot: bulkhead.tryAcquire,
    })
    const body = {
      model: 'client-model',
      messages: [{ role: 'user', content: 'hello' }],
    }

    const timedOut = await gateway(request(body))
    expect(timedOut.status).toBe(200)
    await expect(timedOut.text()).rejects.toMatchObject({
      name: 'TimeoutError',
    })

    const blocked = await gateway(request(body))
    expect(blocked.status).toBe(503)
    expect(upstreamFetch).toHaveBeenCalledOnce()
  })

  it('cancels an oversized upstream response and releases its process slot', async () => {
    const bulkhead = createSharedGatewayBulkhead(1)
    const cancel = vi.fn()
    const upstreamFetch = vi.fn()
      .mockResolvedValueOnce(new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array(3 * 1024 * 1024))
          },
          cancel,
        }),
        { headers: { 'content-type': 'application/json' } },
      ))
      .mockResolvedValueOnce(completionResponse())
    const gateway = createSharedModelGateway({
      resolveIdentity: () => 'identity-1',
      consumeRequestPermit: async () => true,
      acquireCredential: async () => ({ apiKey: 'server-secret' }),
      fetch: upstreamFetch,
      upstreamBaseURL: 'https://upstream.test/v1',
      model: 'server-model',
      timeoutMs: 1_000,
      tryAcquireRequestSlot: bulkhead.tryAcquire,
    })
    const body = {
      model: 'client-model',
      messages: [{ role: 'user', content: 'hello' }],
    }

    const oversized = await gateway(request(body))
    expect(oversized.status).toBe(200)
    await expect(oversized.text()).rejects.toThrow('invalid upstream response')
    expect(cancel).toHaveBeenCalledOnce()

    const admitted = await gateway(request(body))
    expect(admitted.status).toBe(200)
    await expect(admitted.json()).resolves.toMatchObject(completion())
  })

  it('cancels an upstream JSON response containing invalid UTF-8', async () => {
    const cancel = vi.fn()
    const gateway = createSharedModelGateway({
      resolveIdentity: () => 'identity-1',
      consumeRequestPermit: async () => true,
      acquireCredential: async () => ({ apiKey: 'server-secret' }),
      fetch: async () => new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(Uint8Array.from([0xFF]))
          },
          cancel,
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
      upstreamBaseURL: 'https://upstream.test/v1',
      model: 'server-model',
      timeoutMs: 1_000,
    })

    const response = await gateway(request({
      model: 'client-model',
      messages: [{ role: 'user', content: 'hello' }],
    }))

    await expect(response.text()).rejects.toThrow('invalid upstream response')
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('rejects JSON that is not an OpenAI-compatible chat completion', async () => {
    const gateway = createSharedModelGateway({
      resolveIdentity: () => 'identity-1',
      consumeRequestPermit: async () => true,
      acquireCredential: async () => ({ apiKey: 'server-secret' }),
      fetch: async () => new Response('{}', {
        headers: { 'content-type': 'application/json' },
      }),
      upstreamBaseURL: 'https://upstream.test/v1',
      model: 'server-model',
      timeoutMs: 1_000,
    })

    const response = await gateway(request({
      model: 'client-model',
      messages: [{ role: 'user', content: 'hello' }],
    }))

    await expect(response.json()).rejects.toThrow('invalid upstream response')
  })

  it('releases an aborted wrapping slot only after body cancellation settles', async () => {
    const bulkhead = createSharedGatewayBulkhead(1)
    const controller = new AbortController()
    const cancel = vi.fn()
    const upstreamBody = new ReadableStream<Uint8Array>({ cancel })
    const abortingResponse = new Response(null, {
      headers: { 'content-type': 'application/json' },
    })
    Object.defineProperty(abortingResponse, 'body', {
      configurable: true,
      get() {
        controller.abort()
        return upstreamBody
      },
    })
    const upstreamFetch = vi.fn()
      .mockResolvedValueOnce(abortingResponse)
      .mockResolvedValueOnce(completionResponse())
    const gateway = createSharedModelGateway({
      resolveIdentity: () => 'identity-1',
      consumeRequestPermit: async () => true,
      acquireCredential: async () => ({ apiKey: 'server-secret' }),
      fetch: upstreamFetch,
      upstreamBaseURL: 'https://upstream.test/v1',
      model: 'server-model',
      timeoutMs: 1_000,
      tryAcquireRequestSlot: bulkhead.tryAcquire,
    })
    const body = {
      model: 'client-model',
      messages: [{ role: 'user', content: 'hello' }],
    }

    const aborted = await gateway(request(body, { signal: controller.signal }))
    expect(aborted.status).toBe(503)
    expect(cancel).toHaveBeenCalledOnce()

    const cancelling = await gateway(request(body))
    expect(cancelling.status).toBe(503)
    await Promise.resolve()

    const admitted = await gateway(request(body))
    expect(admitted.status).toBe(200)
    await expect(admitted.json()).resolves.toMatchObject(completion())
  })

  it('supports the streamed tool-loop message shape used by the browser agent', async () => {
    const payload = [
      'data: {"id":"completion-1","object":"chat.completion.chunk","created":1,"model":"server-model","choices":[{"index":0,"delta":{"role":"assistant","content":"完成"},"finish_reason":null}]}\r\n\r\n',
      'data: [DONE]\r\n\r\n',
    ].join('')
    const bytes = new TextEncoder().encode(payload)
    const splitUtf8At = bytes.indexOf(0xE5) + 1
    const upstreamFetch = vi.fn(async () => new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes.slice(0, 7))
          controller.enqueue(bytes.slice(7, splitUtf8At))
          controller.enqueue(bytes.slice(splitUtf8At, bytes.length - 3))
          controller.enqueue(bytes.slice(bytes.length - 3))
          controller.close()
        },
      }),
      { headers: { 'content-type': 'text/event-stream' } },
    ))
    const gateway = createSharedModelGateway({
      resolveIdentity: () => 'identity-1',
      consumeRequestPermit: async () => true,
      acquireCredential: async () => ({ apiKey: 'server-secret' }),
      fetch: upstreamFetch,
      upstreamBaseURL: 'https://upstream.test/v1',
      model: 'server-model',
      timeoutMs: 1_000,
    })

    const response = await gateway(request({
      model: 'client-model',
      stream: true,
      stream_options: { include_usage: true },
      messages: [
        { role: 'system', content: 'Teach safely.' },
        { role: 'user', content: 'Continue.' },
        {
          role: 'assistant',
          content: null,
          reasoning_content: 'Need the classroom state.',
          tool_calls: [{
            id: 'call-1',
            type: 'function',
            function: { name: 'read_classroom', arguments: '{}' },
          }],
        },
        { role: 'tool', tool_call_id: 'call-1', content: '{"ok":true}' },
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'read_classroom',
          description: 'Read state',
          parameters: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
        },
      }],
      tool_choice: 'auto',
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/event-stream; charset=utf-8')
    expect(await response.text()).toBe(payload)
  })

  it('forwards each validated SSE event before the upstream stream ends', async () => {
    const firstEvent = 'data: {"id":"completion-1","object":"chat.completion.chunk","created":1,"model":"server-model","choices":[{"index":0,"delta":{"content":"first"},"finish_reason":null}]}\n\n'
    let finish: (() => void) | undefined
    const gateway = createSharedModelGateway({
      resolveIdentity: () => 'identity-1',
      consumeRequestPermit: async () => true,
      acquireCredential: async () => ({ apiKey: 'server-secret' }),
      fetch: async () => new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(firstEvent))
            finish = () => {
              controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
              controller.close()
            }
          },
        }),
        { headers: { 'content-type': 'text/event-stream' } },
      ),
      upstreamBaseURL: 'https://upstream.test/v1',
      model: 'server-model',
      timeoutMs: 1_000,
    })

    const response = await gateway(request({
      model: 'client-model',
      stream: true,
      messages: [{ role: 'user', content: 'hello' }],
    }))
    const reader = response.body!.getReader()

    const first = await reader.read()
    expect(new TextDecoder().decode(first.value)).toBe(firstEvent)
    expect(first.done).toBe(false)

    finish?.()
    const terminal = await reader.read()
    expect(new TextDecoder().decode(terminal.value)).toBe('data: [DONE]\n\n')
    await expect(reader.read()).resolves.toMatchObject({ done: true })
  })

  it('cancels an invalid SSE protocol stream and releases its process slot', async () => {
    const bulkhead = createSharedGatewayBulkhead(1)
    const cancel = vi.fn()
    const validPayload = [
      'data: {"id":"completion-2","object":"chat.completion.chunk","created":1,"model":"server-model","choices":[{"index":0,"delta":{"content":"OK"},"finish_reason":"stop"}]}\n\n',
      'data: [DONE]\n\n',
    ].join('')
    const upstreamFetch = vi.fn()
      .mockResolvedValueOnce(new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('data: {}\n\n'))
          },
          cancel,
        }),
        { headers: { 'content-type': 'text/event-stream' } },
      ))
      .mockResolvedValueOnce(new Response(validPayload, {
        headers: { 'content-type': 'text/event-stream' },
      }))
    const gateway = createSharedModelGateway({
      resolveIdentity: () => 'identity-1',
      consumeRequestPermit: async () => true,
      acquireCredential: async () => ({ apiKey: 'server-secret' }),
      fetch: upstreamFetch,
      upstreamBaseURL: 'https://upstream.test/v1',
      model: 'server-model',
      timeoutMs: 1_000,
      tryAcquireRequestSlot: bulkhead.tryAcquire,
    })
    const body = {
      model: 'client-model',
      stream: true,
      messages: [{ role: 'user', content: 'hello' }],
    }

    const invalid = await gateway(request(body))
    await expect(invalid.text()).rejects.toThrow('invalid upstream response')
    expect(cancel).toHaveBeenCalledOnce()

    const admitted = await gateway(request(body))
    expect(admitted.status).toBe(200)
    await expect(admitted.text()).resolves.toBe(validPayload)
  })

  it.each([
    ['event count', () => ':\n\n'.repeat(256_000)],
    ['line count', () => ':\n'.repeat(70_000)],
    ['single-event bytes', () => `: ${'x'.repeat(300_000)}\n\n`],
  ])('cancels an SSE stream that exceeds the %s limit', async (_limit, payload) => {
    const cancel = vi.fn()
    const gateway = createSharedModelGateway({
      resolveIdentity: () => 'identity-1',
      consumeRequestPermit: async () => true,
      acquireCredential: async () => ({ apiKey: 'server-secret' }),
      fetch: async () => new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(payload()))
          },
          cancel,
        }),
        { headers: { 'content-type': 'text/event-stream' } },
      ),
      upstreamBaseURL: 'https://upstream.test/v1',
      model: 'server-model',
      timeoutMs: 10_000,
    })

    const response = await gateway(request({
      model: 'client-model',
      stream: true,
      messages: [{ role: 'user', content: 'hello' }],
    }))

    await expect(response.text()).rejects.toThrow('invalid upstream response')
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('rejects an SSE stream that ends without the terminal DONE event', async () => {
    const gateway = createSharedModelGateway({
      resolveIdentity: () => 'identity-1',
      consumeRequestPermit: async () => true,
      acquireCredential: async () => ({ apiKey: 'server-secret' }),
      fetch: async () => new Response(
        'data: {"id":"completion-1","object":"chat.completion.chunk","created":1,"model":"server-model","choices":[{"index":0,"delta":{"content":"partial"},"finish_reason":null}]}\n\n',
        { headers: { 'content-type': 'text/event-stream' } },
      ),
      upstreamBaseURL: 'https://upstream.test/v1',
      model: 'server-model',
      timeoutMs: 1_000,
    })

    const response = await gateway(request({
      model: 'client-model',
      stream: true,
      messages: [{ role: 'user', content: 'hello' }],
    }))

    await expect(response.text()).rejects.toThrow('invalid upstream response')
  })

  it('rejects oversized bodies without allocating a credential or calling upstream', async () => {
    const acquireCredential = vi.fn()
    const upstreamFetch = vi.fn()
    const gateway = createSharedModelGateway({
      resolveIdentity: () => 'identity-1',
      consumeRequestPermit: async () => true,
      acquireCredential,
      fetch: upstreamFetch,
      upstreamBaseURL: 'https://upstream.test/v1',
      model: 'server-model',
      timeoutMs: 1_000,
    })
    const oversized = request({
      model: 'client-model',
      messages: [{ role: 'user', content: 'x'.repeat(300_000) }],
    })

    const response = await gateway(oversized)

    expect(response.status).toBe(413)
    expect(await response.json()).toMatchObject({
      error: { code: 'request_too_large' },
    })
    expect(acquireCredential).not.toHaveBeenCalled()
    expect(upstreamFetch).not.toHaveBeenCalled()
  })

  it('keeps the slot when oversized request-body cancellation never settles', async () => {
    const bulkhead = createSharedGatewayBulkhead(1)
    const hanging = new Promise<void>(() => {})
    const cancel = vi.fn(() => hanging)
    const gateway = createSharedModelGateway({
      resolveIdentity: () => 'identity-1',
      consumeRequestPermit: async () => true,
      acquireCredential: async () => ({ apiKey: 'server-secret' }),
      fetch: async () => completionResponse(),
      upstreamBaseURL: 'https://upstream.test/v1',
      model: 'server-model',
      timeoutMs: 1_000,
      tryAcquireRequestSlot: bulkhead.tryAcquire,
    })
    const oversized = new Request(
      'https://playground.test/api/ai-gateway/v1/chat/completions',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array(300_000))
          },
          cancel,
        }),
        duplex: 'half',
      } as RequestInit & { duplex: 'half' },
    )

    const rejected = await gateway(oversized)
    expect(rejected.status).toBe(413)
    expect(cancel).toHaveBeenCalledOnce()

    const blocked = await gateway(request({
      model: 'client-model',
      messages: [{ role: 'user', content: 'hello' }],
    }))
    expect(blocked.status).toBe(503)
  })

  it('maps upstream quota rejection to the stable client quota error without details', async () => {
    const gateway = createSharedModelGateway({
      resolveIdentity: () => 'identity-1',
      consumeRequestPermit: async () => true,
      acquireCredential: async () => ({ apiKey: 'server-secret' }),
      fetch: async () => new Response(
        '{"error":{"message":"internal account 42 is out of credit"}}',
        { status: 429, headers: { 'content-type': 'application/json' } },
      ),
      upstreamBaseURL: 'https://upstream.test/v1',
      model: 'server-model',
      timeoutMs: 1_000,
    })

    const response = await gateway(request({
      model: 'client-model',
      messages: [{ role: 'user', content: 'hello' }],
    }))
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body).toEqual({
      error: {
        code: 'insufficient_user_quota',
        message: 'The shared AI quota is exhausted.',
        type: 'insufficient_user_quota',
      },
    })
    expect(JSON.stringify(body)).not.toContain('account 42')
  })

  it('rejects a rate-limited identity before allocating a credential or calling upstream', async () => {
    const acquireCredential = vi.fn()
    const upstreamFetch = vi.fn()
    const cancelRequestBody = vi.fn()
    const gateway = createSharedModelGateway({
      resolveIdentity: () => 'identity-1',
      consumeRequestPermit: async () => false,
      acquireCredential,
      fetch: upstreamFetch,
      upstreamBaseURL: 'https://upstream.test/v1',
      model: 'server-model',
      timeoutMs: 1_000,
    })

    const response = await gateway(new Request(
      'https://playground.test/api/ai-gateway/v1/chat/completions',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: new ReadableStream<Uint8Array>({
          cancel: cancelRequestBody,
        }),
        duplex: 'half',
      } as RequestInit & { duplex: 'half' },
    ))

    expect(response.status).toBe(429)
    expect(await response.json()).toEqual({
      error: {
        code: 'rate_limit_exceeded',
        message: 'Too many shared AI requests.',
        type: 'rate_limit_exceeded',
      },
    })
    expect(cancelRequestBody).toHaveBeenCalledOnce()
    expect(acquireCredential).not.toHaveBeenCalled()
    expect(upstreamFetch).not.toHaveBeenCalled()
  })

  it('holds a bulkhead slot from body admission until the upstream response ends', async () => {
    const bulkhead = createSharedGatewayBulkhead(1)
    let finishFirstResponse: (() => void) | undefined
    const payload = JSON.stringify(completion())
    const splitAt = Math.floor(payload.length / 2)
    const upstreamFetch = vi.fn(async () => new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(payload.slice(0, splitAt)))
          finishFirstResponse = () => {
            controller.enqueue(new TextEncoder().encode(payload.slice(splitAt)))
            controller.close()
          }
        },
      }),
      { headers: { 'content-type': 'application/json' } },
    ))
    const gateway = createSharedModelGateway({
      resolveIdentity: () => 'identity-1',
      consumeRequestPermit: async () => true,
      acquireCredential: async () => ({ apiKey: 'server-secret' }),
      fetch: upstreamFetch,
      upstreamBaseURL: 'https://upstream.test/v1',
      model: 'server-model',
      timeoutMs: 1_000,
      tryAcquireRequestSlot: bulkhead.tryAcquire,
    })
    const body = {
      model: 'client-model',
      messages: [{ role: 'user', content: 'hello' }],
    }

    const first = await gateway(request(body))
    expect(first.status).toBe(200)
    const rejected = await gateway(request(body))
    expect(rejected.status).toBe(503)
    expect(await rejected.json()).toMatchObject({
      error: { code: 'server_busy' },
    })

    finishFirstResponse?.()
    await first.text()

    const admitted = await gateway(request(body))
    expect(admitted.status).toBe(200)
    finishFirstResponse?.()
    await admitted.body?.cancel()
  })
})
