import { ToolLoopAgent } from 'ai'
import type { UIMessageChunk } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'
import { describe, expect, it, vi } from 'vitest'
import { createScopedChatTransport } from './scoped-chat-transport'

describe('teacher transport with AI SDK 7', () => {
  it('converts a real agent stream and commits before releasing learner text', async () => {
    const model = new MockLanguageModelV4({
      doStream: async () => ({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] })
            controller.enqueue({ type: 'text-start', id: 'answer' })
            controller.enqueue({ type: 'text-delta', id: 'answer', delta: 'Start at main.' })
            controller.enqueue({ type: 'text-end', id: 'answer' })
            controller.enqueue({
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: {
                inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
                outputTokens: { total: 1, text: 1, reasoning: 0 },
              },
            })
            controller.close()
          },
        }),
      }),
    })
    let releaseCommit!: () => void
    const commit = vi.fn(() => new Promise<void>((resolve) => {
      releaseCommit = resolve
    }))
    const transport = createScopedChatTransport(
      new ToolLoopAgent({ model }),
      new AbortController().signal,
      { commit },
    )
    const stream = await transport.sendMessages({
      trigger: 'submit-message',
      chatId: 'sdk7',
      messageId: undefined,
      messages: [{ id: 'question', role: 'user', parts: [{ type: 'text', text: 'Help me.' }] }],
      abortSignal: undefined,
    })
    const reader = stream.getReader()
    let received = false
    const first = reader.read().then((value) => {
      received = true
      return value
    })
    await vi.waitFor(() => expect(commit).toHaveBeenCalledOnce())
    expect(received).toBe(false)
    releaseCommit()
    const chunks: UIMessageChunk[] = []
    let next = await first
    while (!next.done) {
      chunks.push(next.value)
      next = await reader.read()
    }
    expect(chunks).toContainEqual({ type: 'text-delta', id: 'answer', delta: 'Start at main.' })
    expect(chunks.some(chunk => chunk.type === 'finish')).toBe(true)
    expect(model.doStreamCalls).toHaveLength(1)
  })
})
