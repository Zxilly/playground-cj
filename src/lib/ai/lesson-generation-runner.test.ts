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
      type: 'classroom_opened',
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
      event: { type: 'classroom_opened', createdAt: 1 },
    })

    expect(createLessonGenerationMock).not.toHaveBeenCalled()
  })

  it('reports tool-error label and continues to allow LLM retry (recovers with later authoring success)', async () => {
    streamMock.mockResolvedValueOnce({
      fullStream: createAsyncIterable([
        { type: 'text-delta', id: 'empty', text: '' },
        { type: 'tool-error', id: 'tool-err', toolName: 'append_paragraph', error: new Error('boom') },
        { type: 'tool-input-start', id: 'in2', toolName: 'append_paragraph' },
        { type: 'tool-result', toolCallId: 'tool-ok', toolName: 'append_paragraph', output: { ok: true, appended: 1 } },
      ]),
    })
    const { runLessonGenerationStep } = await import('./lesson-generation-runner')
    const progress: string[] = []

    await expect(runLessonGenerationStep({
      config: { apiKey: 'test-key' } as Partial<LLMConfig>,
      toolkit: {} as Toolkit,
      bridge: {} as AIClassroomBridgeValue,
      event: { type: 'classroom_opened', createdAt: 1 },
      onProgress: chunk => progress.push(chunk),
    })).resolves.toBeUndefined()

    expect(progress).toContain('工具失败：append_paragraph\n')
    expect(progress).toContain('完成工具：append_paragraph\n')
  })

  it('reports tool-input-error label and continues to allow LLM retry (recovers with later authoring success)', async () => {
    streamMock.mockResolvedValueOnce({
      fullStream: createAsyncIterable([
        { type: 'tool-input-error', id: 'in-err', toolName: 'set_phase', errorText: 'bad input' },
        { type: 'tool-input-start', id: 'in2', toolName: 'append_paragraph' },
        { type: 'tool-result', toolCallId: 'tool-ok', toolName: 'append_paragraph', output: { ok: true, appended: 1 } },
      ]),
    })
    const { runLessonGenerationStep } = await import('./lesson-generation-runner')
    const progress: string[] = []

    await expect(runLessonGenerationStep({
      config: { apiKey: 'test-key' } as Partial<LLMConfig>,
      toolkit: {} as Toolkit,
      bridge: {} as AIClassroomBridgeValue,
      event: { type: 'classroom_opened', createdAt: 1 },
      onProgress: chunk => progress.push(chunk),
    })).resolves.toBeUndefined()

    expect(progress).toContain('工具失败：set_phase\n')
    expect(progress).toContain('完成工具：append_paragraph\n')
  })

  it('throws when tool errors occurred and no authoring tool ever succeeded', async () => {
    streamMock.mockResolvedValueOnce({
      fullStream: createAsyncIterable([
        { type: 'tool-input-start', id: 'in', toolName: 'append_paragraph' },
        { type: 'tool-error', id: 'tool-err', toolName: 'append_paragraph', error: new Error('boom') },
      ]),
    })
    const { runLessonGenerationStep } = await import('./lesson-generation-runner')

    await expect(runLessonGenerationStep({
      config: { apiKey: 'test-key' } as Partial<LLMConfig>,
      toolkit: {} as Toolkit,
      bridge: {} as AIClassroomBridgeValue,
      event: { type: 'classroom_opened', createdAt: 1 },
    })).rejects.toThrow(/produced no authoring output/)
  })

  it('throws when authoring tool only returns retry hint (ok:false) and never succeeds', async () => {
    streamMock.mockResolvedValueOnce({
      fullStream: createAsyncIterable([
        { type: 'tool-input-start', id: 'in', toolName: 'set_current_quiz' },
        { type: 'tool-error', id: 'tool-err', toolName: 'set_current_quiz', error: new Error('zod') },
        { type: 'tool-input-start', id: 'in2', toolName: 'set_current_quiz' },
        // Tool returns retry hint (ok: false) — should NOT count as authoring success
        { type: 'tool-result', toolCallId: 'tool-hint', toolName: 'set_current_quiz', output: { ok: false, error: 'zod', expectedShape: {} } },
      ]),
    })
    const { runLessonGenerationStep } = await import('./lesson-generation-runner')

    await expect(runLessonGenerationStep({
      config: { apiKey: 'test-key' } as Partial<LLMConfig>,
      toolkit: {} as Toolkit,
      bridge: {} as AIClassroomBridgeValue,
      event: { type: 'classroom_opened', createdAt: 1 },
    })).rejects.toThrow(/produced no authoring output/)
  })

  it('does not throw when only non-authoring tool failed and authoring succeeded', async () => {
    streamMock.mockResolvedValueOnce({
      fullStream: createAsyncIterable([
        { type: 'tool-input-start', id: 'in', toolName: 'set_phase' },
        { type: 'tool-error', id: 'tool-err', toolName: 'set_phase', error: new Error('boom') },
        { type: 'tool-input-start', id: 'in2', toolName: 'append_heading' },
        { type: 'tool-result', toolCallId: 'tool-ok', toolName: 'append_heading', output: { ok: true, appended: 1 } },
      ]),
    })
    const { runLessonGenerationStep } = await import('./lesson-generation-runner')

    await expect(runLessonGenerationStep({
      config: { apiKey: 'test-key' } as Partial<LLMConfig>,
      toolkit: {} as Toolkit,
      bridge: {} as AIClassroomBridgeValue,
      event: { type: 'classroom_opened', createdAt: 1 },
    })).resolves.toBeUndefined()
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
      event: { type: 'classroom_opened', createdAt: 1 },
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
