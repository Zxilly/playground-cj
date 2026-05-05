import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AIBridgeValue } from '@/components/tour/EditorBridgeContext'
import type { ClassroomEvent } from './classroom/types'
import type { LLMConfig } from './model-provider'
import type { Toolkit } from '@assistant-ui/react'

const streamMock = vi.hoisted(() => vi.fn())
const createLessonAuthorAgentMock = vi.hoisted(() => vi.fn(() => ({
  stream: streamMock,
})))

vi.mock('./lesson-author-agent', () => ({
  createLessonAuthorAgent: createLessonAuthorAgentMock,
  createLessonAuthorEventEnvelope: (event: ClassroomEvent) => ({ event }),
}))

describe('runLessonAuthorStep', () => {
  beforeEach(() => {
    streamMock.mockReset()
    createLessonAuthorAgentMock.mockClear()
  })

  it('streams text and tool progress while consuming the author stream', async () => {
    const event: ClassroomEvent = {
      type: 'page_opened',
      createdAt: 1,
      summary: 'opened',
    }
    streamMock.mockResolvedValueOnce({
      fullStream: createAsyncIterable([
        { type: 'text-delta', id: 'text-1', text: '正在规划课程' },
        { type: 'tool-input-start', id: 'tool-1', toolName: 'read_classroom_state' },
        { type: 'tool-result', toolCallId: 'tool-1', toolName: 'append_lesson_content', output: undefined },
      ]),
    })
    const { runLessonAuthorStep } = await import('./lesson-author-runner')
    const progress: string[] = []

    await runLessonAuthorStep({
      config: { apiKey: 'test-key' } as Partial<LLMConfig>,
      toolkit: {} as Toolkit,
      bridge: {} as AIBridgeValue,
      event,
      onProgress: chunk => progress.push(chunk),
    })

    expect(streamMock).toHaveBeenCalledWith(expect.objectContaining({
      prompt: JSON.stringify({ event }),
    }))
    expect(progress).toEqual([
      '正在规划课程',
      '\n调用工具：read_classroom_state\n',
      '完成工具：append_lesson_content\n',
    ])
  })
})

async function* createAsyncIterable(parts: unknown[]) {
  for (const part of parts)
    yield part
}
