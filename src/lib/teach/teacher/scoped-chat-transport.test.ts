import type { Agent, ToolSet, UIMessageChunk } from 'ai'
import { describe, expect, it, vi } from 'vitest'
import { createScopedChatTransport } from './scoped-chat-transport'

function agentStreaming(chunks: UIMessageChunk[]): Agent<never, ToolSet, never> {
  return agentFromUIStream(() => new ReadableStream<UIMessageChunk>({
    start(controller) {
      for (const chunk of chunks)
        controller.enqueue(chunk)
      controller.close()
    },
  }))
}

function agentFromUIStream(
  createStream: () => ReadableStream<UIMessageChunk>,
): Agent<never, ToolSet, never> {
  return {
    version: 'agent-v1',
    tools: {},
    stream: vi.fn(async () => ({
      toUIMessageStream: createStream,
    })),
  } as unknown as Agent<never, ToolSet, never>
}

const sendOptions = {
  trigger: 'submit-message' as const,
  chatId: 'chat:1',
  messageId: undefined,
  messages: [{
    id: 'message:1',
    role: 'user' as const,
    parts: [{ type: 'text' as const, text: 'Help me understand this.' }],
  }],
  abortSignal: undefined,
}

function boundary(commit: () => Promise<void>) {
  return { commit }
}

describe('scoped teacher chat transport', () => {
  it('fails closed instead of reconnecting an unguarded teacher stream', async () => {
    const transport = createScopedChatTransport(
      agentFromUIStream(() => new ReadableStream<UIMessageChunk>()),
      new AbortController().signal,
      boundary(vi.fn(async () => undefined)),
    )

    await expect(
      transport.reconnectToStream({ chatId: 'teacher-chat' }),
    ).resolves.toBeNull()
  })

  it('holds the turn lease after a deadline until provider stream creation settles', async () => {
    const firstDeadline = new AbortController()
    const nextDeadline = new AbortController()
    const timeout = vi.spyOn(AbortSignal, 'timeout')
      .mockReturnValueOnce(firstDeadline.signal)
      .mockReturnValueOnce(nextDeadline.signal)
    try {
      let streamCount = 0
      let finishStalledProvider!: () => void
      const stalledProvider = new Promise<void>((resolve) => {
        finishStalledProvider = resolve
      })
      const agent = {
        version: 'agent-v1',
        tools: {},
        stream: vi.fn(async () => {
          streamCount += 1
          if (streamCount === 1)
            await stalledProvider
          return {
            toUIMessageStream: () => new ReadableStream<UIMessageChunk>({
              start(controller) {
                controller.close()
              },
            }),
          }
        }),
      } as unknown as Agent<never, ToolSet, never>
      const closeTurnBudget = vi.fn()
      const prepareTurn = vi.fn((_signal: AbortSignal) => closeTurnBudget)
      const transport = createScopedChatTransport(
        agent,
        new AbortController().signal,
        boundary(vi.fn(async () => undefined)),
        prepareTurn,
      )

      const stalledTurn = transport.sendMessages(sendOptions)
      const stalledTurnFailure = expect(stalledTurn)
        .rejects
        .toMatchObject({ name: 'TimeoutError' })
      await vi.waitFor(() => expect(prepareTurn).toHaveBeenCalledOnce())
      firstDeadline.abort(new DOMException(
        'Teacher turn exceeded its deadline',
        'TimeoutError',
      ))

      await stalledTurnFailure
      expect(closeTurnBudget).not.toHaveBeenCalled()
      await expect(transport.sendMessages(sendOptions)).rejects.toThrow(
        /turn is already running/,
      )

      finishStalledProvider()
      await vi.waitFor(() => expect(closeTurnBudget).toHaveBeenCalledOnce())
      const nextStream = await transport.sendMessages(sendOptions)
      await expect(nextStream.getReader().read()).resolves.toEqual({
        done: true,
        value: undefined,
      })
    }
    finally {
      timeout.mockRestore()
    }
  })

  it('does not admit another turn when provider deadline cancellation never settles', async () => {
    vi.useFakeTimers()
    const firstDeadline = new AbortController()
    const nextDeadline = new AbortController()
    const timeout = vi.spyOn(AbortSignal, 'timeout')
      .mockReturnValueOnce(firstDeadline.signal)
      .mockReturnValueOnce(nextDeadline.signal)
    try {
      const providerCancel = vi.fn(
        () => new Promise<void>(() => undefined),
      )
      let streamCount = 0
      const agent = agentFromUIStream(() => {
        streamCount += 1
        if (streamCount > 1) {
          return new ReadableStream<UIMessageChunk>({
            start(controller) {
              controller.close()
            },
          })
        }
        return new ReadableStream<UIMessageChunk>({
          pull: () => new Promise<void>(() => undefined),
          cancel: providerCancel,
        })
      })
      const closeTurnBudget = vi.fn()
      const prepareTurn = vi.fn((_signal: AbortSignal) => closeTurnBudget)
      const transport = createScopedChatTransport(
        agent,
        new AbortController().signal,
        boundary(vi.fn(async () => undefined)),
        prepareTurn,
      )
      const reader = (await transport.sendMessages(sendOptions)).getReader()
      const stalledReadFailure = expect(reader.read())
        .rejects
        .toMatchObject({ name: 'TimeoutError' })

      firstDeadline.abort(new DOMException(
        'Teacher turn exceeded its deadline',
        'TimeoutError',
      ))
      await vi.waitFor(() => expect(providerCancel).toHaveBeenCalledOnce())
      expect(closeTurnBudget).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1_000)
      await stalledReadFailure
      expect(closeTurnBudget).not.toHaveBeenCalled()
      await expect(transport.sendMessages(sendOptions)).rejects.toThrow(
        /turn is already running/,
      )
    }
    finally {
      timeout.mockRestore()
      vi.useRealTimers()
    }
  })

  it('holds the turn lease until the provider reader finishes cancelling', async () => {
    let finishProviderCancel!: () => void
    const providerCancelFinished = new Promise<void>((resolve) => {
      finishProviderCancel = resolve
    })
    let streamCount = 0
    const agent = agentFromUIStream(() => {
      streamCount += 1
      if (streamCount > 1) {
        return new ReadableStream<UIMessageChunk>({
          start(controller) {
            controller.close()
          },
        })
      }
      return new ReadableStream<UIMessageChunk>({
        cancel: vi.fn(() => providerCancelFinished),
      })
    })
    const closeTurnBudget = vi.fn()
    const prepareTurn = vi.fn((_signal: AbortSignal) => closeTurnBudget)
    const transport = createScopedChatTransport(
      agent,
      new AbortController().signal,
      boundary(vi.fn(async () => undefined)),
      prepareTurn,
    )
    const stream = await transport.sendMessages(sendOptions)

    const cancelling = stream.cancel('learner stopped the turn')
    await expect(transport.sendMessages(sendOptions)).rejects.toThrow(
      /turn is already running/,
    )
    expect(prepareTurn).toHaveBeenCalledWith(expect.any(AbortSignal))
    expect(closeTurnBudget).not.toHaveBeenCalled()

    finishProviderCancel()
    await cancelling
    expect(closeTurnBudget).toHaveBeenCalledOnce()
    const nextStream = await transport.sendMessages(sendOptions)
    await expect(nextStream.getReader().read()).resolves.toEqual({
      done: true,
      value: undefined,
    })
    expect(prepareTurn.mock.calls[1]?.[0])
      .not
      .toBe(prepareTurn.mock.calls[0]?.[0])
  })

  it('aborts capabilities immediately but holds the lease when provider cancellation never settles', async () => {
    vi.useFakeTimers()
    try {
      let streamCount = 0
      const agent = agentFromUIStream(() => {
        streamCount += 1
        if (streamCount > 1) {
          return new ReadableStream<UIMessageChunk>({
            start(controller) {
              controller.close()
            },
          })
        }
        return new ReadableStream<UIMessageChunk>({
          cancel: vi.fn(() => new Promise<void>(() => undefined)),
        })
      })
      const closeTurnBudget = vi.fn()
      const prepareTurn = vi.fn((_signal: AbortSignal) => closeTurnBudget)
      const transport = createScopedChatTransport(
        agent,
        new AbortController().signal,
        boundary(vi.fn(async () => undefined)),
        prepareTurn,
      )
      const stream = await transport.sendMessages(sendOptions)
      const turnSignal = prepareTurn.mock.calls[0]![0]

      const cancelling = stream.cancel('learner stopped the turn')
      await vi.waitFor(() => expect(turnSignal.aborted).toBe(true))
      expect(closeTurnBudget).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1_000)
      await cancelling
      expect(closeTurnBudget).not.toHaveBeenCalled()
      await expect(transport.sendMessages(sendOptions)).rejects.toThrow(
        /turn is already running/,
      )
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('commits assistance before exposing any part of the complete teacher turn', async () => {
    let release!: () => void
    const blocked = new Promise<void>((resolve) => {
      release = resolve
    })
    const guard = vi.fn(() => blocked)
    const prepareTurn = vi.fn()
    const transport = createScopedChatTransport(
      agentStreaming([
        { type: 'text-start', id: 'text:1' },
        { type: 'text-delta', id: 'text:1', delta: 'answer' },
        {
          type: 'tool-output-available',
          toolCallId: 'tool:1',
          output: { createdExerciseInstanceId: 'exercise:late' },
        } as UIMessageChunk,
        { type: 'text-end', id: 'text:1' },
      ]),
      new AbortController().signal,
      boundary(guard),
      prepareTurn,
    )
    const stream = await transport.sendMessages(sendOptions)
    const reading = stream.getReader().read()

    await vi.waitFor(() => expect(guard).toHaveBeenCalledOnce())
    await expect(transport.sendMessages(sendOptions)).rejects.toThrow(
      /turn is already running/,
    )
    expect(prepareTurn).toHaveBeenCalledOnce()
    let exposed = false
    void reading.then(() => {
      exposed = true
    })
    await Promise.resolve()
    expect(exposed).toBe(false)

    release()
    await expect(reading).resolves.toMatchObject({
      done: false,
      value: { type: 'text-start', id: 'text:1' },
    })
  })

  it('holds the turn lease until an aborted exposure commit actually settles', async () => {
    let finishCommit!: () => void
    const pendingCommit = new Promise<void>((resolve) => {
      finishCommit = resolve
    })
    const caller = new AbortController()
    const closeTurnBudget = vi.fn()
    const prepareTurn = vi.fn((_signal: AbortSignal) => closeTurnBudget)
    const guard = vi.fn(() => pendingCommit)
    const transport = createScopedChatTransport(
      agentStreaming([
        { type: 'text-start', id: 'text:1' },
        { type: 'text-delta', id: 'text:1', delta: 'answer' },
        { type: 'text-end', id: 'text:1' },
      ]),
      new AbortController().signal,
      boundary(guard),
      prepareTurn,
    )
    const stream = await transport.sendMessages({
      ...sendOptions,
      abortSignal: caller.signal,
    })
    const reading = stream.getReader().read()

    await vi.waitFor(() => expect(guard).toHaveBeenCalledOnce())
    caller.abort(new DOMException('learner stopped', 'AbortError'))
    await expect(reading).rejects.toMatchObject({ name: 'AbortError' })
    expect(closeTurnBudget).not.toHaveBeenCalled()
    await expect(transport.sendMessages(sendOptions)).rejects.toThrow(
      /turn is already running/,
    )

    finishCommit()
    await vi.waitFor(() => expect(closeTurnBudget).toHaveBeenCalledOnce())
    const nextStream = await transport.sendMessages(sendOptions)
    await expect(nextStream.getReader().read()).resolves.toMatchObject({
      done: false,
      value: { type: 'text-start', id: 'text:1' },
    })
  })

  it('removes reasoning, provider metadata, tool payloads, and raw errors', async () => {
    const guard = vi.fn(async () => undefined)
    const transport = createScopedChatTransport(
      agentStreaming([
        {
          type: 'reasoning-delta',
          id: 'reasoning:1',
          delta: 'private chain of thought',
        },
        {
          type: 'tool-input-available',
          toolCallId: 'tool:1',
          toolName: 'read_content_pack',
          input: { conceptId: 'secret', expectedOutput: 'answer' },
        },
        {
          type: 'tool-output-available',
          toolCallId: 'tool:1',
          output: { expectedOutput: 'private answer' },
        },
        { type: 'text-start', id: 'text:1' },
        { type: 'text-delta', id: 'text:1', delta: 'Safe explanation.' },
        { type: 'text-end', id: 'text:1' },
        {
          type: 'error',
          errorText: 'credential=private',
        },
      ]),
      new AbortController().signal,
      boundary(guard),
    )
    const reader = (await transport.sendMessages(sendOptions)).getReader()
    const chunks: UIMessageChunk[] = []
    while (true) {
      const next = await reader.read()
      if (next.done)
        break
      chunks.push(next.value)
    }

    expect(guard).toHaveBeenCalledOnce()
    expect(JSON.stringify(chunks)).not.toContain('private')
    expect(JSON.stringify(chunks)).not.toContain('read_content_pack')
    expect(chunks.some(chunk => chunk.type.startsWith('tool-'))).toBe(false)
    expect(chunks).toContainEqual({
      type: 'error',
      errorText: 'Teacher response failed.',
    })
  })

  it('does not persist assistance for a payload-free read-only tool turn', async () => {
    const guard = vi.fn(async () => undefined)
    const transport = createScopedChatTransport(
      agentStreaming([
        {
          type: 'tool-input-available',
          toolCallId: 'tool:1',
          toolName: 'read_classroom_state',
          input: {},
        },
        {
          type: 'tool-output-available',
          toolCallId: 'tool:1',
          output: { privateState: true },
        },
      ]),
      new AbortController().signal,
      boundary(guard),
    )
    const reader = (await transport.sendMessages(sendOptions)).getReader()
    let done = false
    while (!done)
      done = (await reader.read()).done

    expect(guard).not.toHaveBeenCalled()
  })

  it('fails closed on a raw chunk flood even when every chunk is filtered', async () => {
    const guard = vi.fn(async () => undefined)
    const chunks: UIMessageChunk[] = Array.from({ length: 4_097 }, (_, index) => ({
      type: 'reasoning-delta' as const,
      id: `reasoning:${index}`,
      delta: 'discarded',
    }))
    const transport = createScopedChatTransport(
      agentStreaming(chunks),
      new AbortController().signal,
      boundary(guard),
    )
    const reader = (await transport.sendMessages(sendOptions)).getReader()

    await expect(reader.read()).rejects.toThrow(/raw chunk limit/)
    expect(guard).not.toHaveBeenCalled()
  })

  it.each([
    ['text-start id', { type: 'text-start', id: 'x'.repeat(513) }],
    ['text-delta id', { type: 'text-delta', id: 'x'.repeat(513), delta: 'answer' }],
    ['text-end id', { type: 'text-end', id: 'x'.repeat(513) }],
    ['start messageId', { type: 'start', messageId: 'x'.repeat(513) }],
    [
      'finish reason',
      {
        type: 'finish',
        finishReason: 'x'.repeat(513),
      } as unknown as UIMessageChunk,
    ],
  ] satisfies Array<[string, UIMessageChunk]>)(
    'fails closed on oversized retained metadata: %s',
    async (_label, oversizedChunk) => {
      const guard = vi.fn(async () => undefined)
      const transport = createScopedChatTransport(
        agentStreaming([oversizedChunk]),
        new AbortController().signal,
        boundary(guard),
      )
      const reader = (await transport.sendMessages(sendOptions)).getReader()

      await expect(reader.read()).rejects.toThrow(/metadata limit/)
      expect(guard).not.toHaveBeenCalled()
    },
  )

  it('does not open a permanent exposure epoch for empty text framing', async () => {
    const guard = vi.fn(async () => undefined)
    const transport = createScopedChatTransport(
      agentStreaming([
        { type: 'text-start', id: 'text:empty' },
        { type: 'text-delta', id: 'text:empty', delta: ' \n\t ' },
        { type: 'text-end', id: 'text:empty' },
      ]),
      new AbortController().signal,
      boundary(guard),
    )
    const reader = (await transport.sendMessages(sendOptions)).getReader()
    let done = false
    while (!done)
      done = (await reader.read()).done

    expect(guard).not.toHaveBeenCalled()
  })

  it('fails closed instead of buffering an unbounded empty chunk flood', async () => {
    const guard = vi.fn(async () => undefined)
    const chunks: UIMessageChunk[] = [
      { type: 'text-start', id: 'text:flood' },
      ...Array.from({ length: 4_096 }, () => ({
        type: 'text-delta' as const,
        id: 'text:flood',
        delta: '',
      })),
      { type: 'text-end', id: 'text:flood' },
    ]
    const transport = createScopedChatTransport(
      agentStreaming(chunks),
      new AbortController().signal,
      boundary(guard),
    )
    const reader = (await transport.sendMessages(sendOptions)).getReader()

    await expect(reader.read()).rejects.toThrow(/chunk limit/)
    expect(guard).not.toHaveBeenCalled()
  })
})
