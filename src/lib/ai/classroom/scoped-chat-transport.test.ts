import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createScopedChatTransport } from './scoped-chat-transport'

const sendMessagesMock = vi.hoisted(() => vi.fn())
const reconnectToStreamMock = vi.hoisted(() => vi.fn())

vi.mock('ai', () => ({
  DirectChatTransport: class MockDirectChatTransport {
    constructor(_opts: unknown) {}
    sendMessages = sendMessagesMock
    reconnectToStream = reconnectToStreamMock
  },
}))

describe('createScopedChatTransport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes scope signal alone when upstream signal is undefined', async () => {
    const scope = new AbortController()
    const transport = createScopedChatTransport({} as never, scope.signal)
    sendMessagesMock.mockResolvedValue(new ReadableStream())

    await transport.sendMessages({ messages: [], chatId: 'c', trigger: 'submit-message' } as never)

    const passed = sendMessagesMock.mock.calls[0][0].abortSignal
    expect(passed).toBe(scope.signal)
  })

  it('merges upstream and scope signals via AbortSignal.any when upstream is provided', async () => {
    const scope = new AbortController()
    const upstream = new AbortController()
    const transport = createScopedChatTransport({} as never, scope.signal)
    sendMessagesMock.mockResolvedValue(new ReadableStream())

    await transport.sendMessages({
      messages: [],
      chatId: 'c',
      trigger: 'submit-message',
      abortSignal: upstream.signal,
    } as never)

    const merged = sendMessagesMock.mock.calls[0][0].abortSignal
    expect(merged).not.toBe(scope.signal)
    expect(merged).not.toBe(upstream.signal)
    expect(merged.aborted).toBe(false)

    scope.abort()
    expect(merged.aborted).toBe(true)
  })

  it('aborts merged signal when upstream signal aborts', async () => {
    const scope = new AbortController()
    const upstream = new AbortController()
    const transport = createScopedChatTransport({} as never, scope.signal)
    sendMessagesMock.mockResolvedValue(new ReadableStream())

    await transport.sendMessages({
      messages: [],
      chatId: 'c',
      trigger: 'submit-message',
      abortSignal: upstream.signal,
    } as never)

    const merged = sendMessagesMock.mock.calls[0][0].abortSignal
    expect(merged.aborted).toBe(false)
    upstream.abort()
    expect(merged.aborted).toBe(true)
    expect(scope.signal.aborted).toBe(false)
  })

  it('reconnectToStream also merges scope signal', async () => {
    const scope = new AbortController()
    const transport = createScopedChatTransport({} as never, scope.signal)
    reconnectToStreamMock.mockResolvedValue(null)

    await transport.reconnectToStream({ chatId: 'c' } as never)

    const passed = reconnectToStreamMock.mock.calls[0][0].abortSignal
    expect(passed).toBe(scope.signal)
  })

  it('reconnectToStream merges upstream + scope when upstream provided', async () => {
    const scope = new AbortController()
    const upstream = new AbortController()
    const transport = createScopedChatTransport({} as never, scope.signal)
    reconnectToStreamMock.mockResolvedValue(null)

    await transport.reconnectToStream({ chatId: 'c', abortSignal: upstream.signal } as never)

    const merged = reconnectToStreamMock.mock.calls[0][0].abortSignal
    expect(merged.aborted).toBe(false)
    scope.abort()
    expect(merged.aborted).toBe(true)
  })
})
