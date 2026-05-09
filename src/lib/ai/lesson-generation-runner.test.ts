import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import type { ClassroomEvent } from './classroom/types'
import type { LLMConfig } from './model-provider'
import type { Toolkit } from '@assistant-ui/react'

const streamMock = vi.hoisted(() => vi.fn())
const createLessonGenerationMock = vi.hoisted(() => vi.fn(() => ({
  stream: streamMock,
})))

vi.mock('./lesson-generation', () => ({
  createLessonGeneration: createLessonGenerationMock,
  createLessonGenerationEventEnvelope: (event: ClassroomEvent) => ({ event }),
}))

vi.mock('@lingui/core/macro', () => ({
  t: (strings: TemplateStringsArray, ...values: unknown[]) => String.raw({ raw: strings }, ...values),
}))

describe('runLessonGenerationStep', () => {
  beforeEach(() => {
    streamMock.mockReset()
    createLessonGenerationMock.mockClear()
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
    const { runLessonGenerationStep } = await import('./lesson-generation-runner')
    const progress: string[] = []

    await runLessonGenerationStep({
      config: { apiKey: 'test-key' } as Partial<LLMConfig>,
      toolkit: {} as Toolkit,
      bridge: {} as AIClassroomBridgeValue,
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

  it('does not create an agent when the api key is missing', async () => {
    const { runLessonGenerationStep } = await import('./lesson-generation-runner')

    await runLessonGenerationStep({
      config: {} as Partial<LLMConfig>,
      toolkit: {} as Toolkit,
      bridge: {} as AIClassroomBridgeValue,
      event: { type: 'page_opened', createdAt: 1 },
    })

    expect(createLessonGenerationMock).not.toHaveBeenCalled()
  })

  it('throws on tool-error and reports the failure label first', async () => {
    streamMock.mockResolvedValueOnce({
      fullStream: createAsyncIterable([
        { type: 'text-delta', id: 'empty', text: '' },
        { type: 'tool-error', id: 'tool-err', toolName: 'append_lesson_content', error: new Error('boom') },
      ]),
    })
    const { runLessonGenerationStep } = await import('./lesson-generation-runner')
    const progress: string[] = []

    await expect(runLessonGenerationStep({
      config: { apiKey: 'test-key' } as Partial<LLMConfig>,
      toolkit: {} as Toolkit,
      bridge: {} as AIClassroomBridgeValue,
      event: { type: 'page_opened', createdAt: 1 },
      onProgress: chunk => progress.push(chunk),
    })).rejects.toThrowError(/append_lesson_content/)

    expect(progress).toEqual(['工具失败：append_lesson_content\n'])
  })

  it('throws on tool-input-error and surfaces errorText in the message', async () => {
    streamMock.mockResolvedValueOnce({
      fullStream: createAsyncIterable([
        { type: 'tool-input-error', id: 'in-err', toolName: 'set_phase', errorText: 'bad input' },
      ]),
    })
    const { runLessonGenerationStep } = await import('./lesson-generation-runner')

    await expect(runLessonGenerationStep({
      config: { apiKey: 'test-key' } as Partial<LLMConfig>,
      toolkit: {} as Toolkit,
      bridge: {} as AIClassroomBridgeValue,
      event: { type: 'page_opened', createdAt: 1 },
    })).rejects.toThrowError(/set_phase failed: bad input/)
  })

  it('stops consuming stream parts after an abort signal fires', async () => {
    const controller = new AbortController()
    streamMock.mockResolvedValueOnce({
      fullStream: createAsyncIterable([
        { type: 'text-delta', id: 'before', text: 'before' },
        { type: 'text-delta', id: 'after', text: 'after' },
      ], () => controller.abort()),
    })
    const { runLessonGenerationStep } = await import('./lesson-generation-runner')
    const progress: string[] = []

    await runLessonGenerationStep({
      config: { apiKey: 'test-key' } as Partial<LLMConfig>,
      toolkit: {} as Toolkit,
      bridge: {} as AIClassroomBridgeValue,
      event: { type: 'page_opened', createdAt: 1 },
      abortSignal: controller.signal,
      onProgress: chunk => progress.push(chunk),
    })

    expect(progress).toEqual(['before'])
  })
})

async function* createAsyncIterable(parts: unknown[], afterFirst?: () => void) {
  for (const [index, part] of parts.entries()) {
    yield part
    if (index === 0)
      afterFirst?.()
  }
}
