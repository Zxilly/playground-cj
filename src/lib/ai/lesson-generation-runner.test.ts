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
  isLessonOrchestrationTool: (name: string) =>
    new Set([
      'append_content_reference_group',
      'append_bridge_note',
      'append_skip_marker',
      'create_exercise_instance',
      'save_clarification',
      'save_remediation',
    ]).has(name),
}))

vi.mock('@lingui/core/macro', () => ({
  t: (strings: TemplateStringsArray, ...values: unknown[]) => String.raw({ raw: strings }, ...values),
}))

describe('runLessonGenerationStep', () => {
  beforeEach(() => {
    streamMock.mockReset()
    createLessonGenerationMock.mockClear()
  })

  it('streams only structured tool progress while consuming the author stream', async () => {
    const event: ClassroomEvent = {
      type: 'classroom_opened',
      createdAt: 1,
      summary: 'opened',
    }
    streamMock.mockResolvedValueOnce({
      fullStream: createAsyncIterable([
        { type: 'text-delta', id: 'text-1', text: '正在规划课程' },
        { type: 'tool-input-start', id: 'tool-1', toolName: 'read_classroom_state' },
        { type: 'tool-result', toolCallId: 'tool-1', toolName: 'append_content_reference_group', output: { ok: true, appended: 1 } },
      ]),
    })
    const { runLessonGenerationStep } = await import('./lesson-generation-runner')
    const progress: unknown[] = []

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
      { type: 'tool-start', toolCallId: 'tool-1', toolName: 'read_classroom_state' },
      { type: 'tool-result', toolCallId: 'tool-1', toolName: 'append_content_reference_group', output: { ok: true, appended: 1 } },
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

  it('reports tool-error label and continues to allow LLM retry (recovers with later orchestration success)', async () => {
    streamMock.mockResolvedValueOnce({
      fullStream: createAsyncIterable([
        { type: 'text-delta', id: 'empty', text: '' },
        { type: 'tool-error', id: 'tool-err', toolName: 'append_content_reference_group', error: new Error('boom') },
        { type: 'tool-input-start', id: 'in2', toolName: 'append_content_reference_group' },
        { type: 'tool-result', toolCallId: 'tool-ok', toolName: 'append_content_reference_group', output: { ok: true, appended: 1 } },
      ]),
    })
    const { runLessonGenerationStep } = await import('./lesson-generation-runner')
    const progress: unknown[] = []

    await expect(runLessonGenerationStep({
      config: { apiKey: 'test-key' } as Partial<LLMConfig>,
      toolkit: {} as Toolkit,
      bridge: {} as AIClassroomBridgeValue,
      event: { type: 'classroom_opened', createdAt: 1 },
      onProgress: chunk => progress.push(chunk),
    })).resolves.toBeUndefined()

    expect(progress).toContainEqual({
      type: 'tool-error',
      toolCallId: 'tool-err',
      toolName: 'append_content_reference_group',
      error: new Error('boom'),
    })
    expect(progress).toContainEqual({
      type: 'tool-result',
      toolCallId: 'tool-ok',
      toolName: 'append_content_reference_group',
      output: { ok: true, appended: 1 },
    })
  })

  it('reports tool-input-error label and continues to allow LLM retry (recovers with later orchestration success)', async () => {
    streamMock.mockResolvedValueOnce({
      fullStream: createAsyncIterable([
        { type: 'tool-input-error', id: 'in-err', toolName: 'read_classroom_state', errorText: 'bad input' },
        { type: 'tool-input-start', id: 'in2', toolName: 'append_content_reference_group' },
        { type: 'tool-result', toolCallId: 'tool-ok', toolName: 'append_content_reference_group', output: { ok: true, appended: 1 } },
      ]),
    })
    const { runLessonGenerationStep } = await import('./lesson-generation-runner')
    const progress: unknown[] = []

    await expect(runLessonGenerationStep({
      config: { apiKey: 'test-key' } as Partial<LLMConfig>,
      toolkit: {} as Toolkit,
      bridge: {} as AIClassroomBridgeValue,
      event: { type: 'classroom_opened', createdAt: 1 },
      onProgress: chunk => progress.push(chunk),
    })).resolves.toBeUndefined()

    expect(progress).toContainEqual({
      type: 'tool-error',
      toolCallId: 'in-err',
      toolName: 'read_classroom_state',
      error: 'bad input',
    })
    expect(progress).toContainEqual({
      type: 'tool-result',
      toolCallId: 'tool-ok',
      toolName: 'append_content_reference_group',
      output: { ok: true, appended: 1 },
    })
  })

  it('throws when tool errors occurred and no orchestration tool ever succeeded', async () => {
    streamMock.mockResolvedValueOnce({
      fullStream: createAsyncIterable([
        { type: 'tool-input-start', id: 'in', toolName: 'append_content_reference_group' },
        { type: 'tool-error', id: 'tool-err', toolName: 'append_content_reference_group', error: new Error('boom') },
      ]),
    })
    const { runLessonGenerationStep } = await import('./lesson-generation-runner')

    await expect(runLessonGenerationStep({
      config: { apiKey: 'test-key' } as Partial<LLMConfig>,
      toolkit: {} as Toolkit,
      bridge: {} as AIClassroomBridgeValue,
      event: { type: 'classroom_opened', createdAt: 1 },
    })).rejects.toThrow(/lesson_generation_failed/)
  })

  it('throws when the stream completes without any stream output', async () => {
    streamMock.mockResolvedValueOnce({
      fullStream: createAsyncIterable([
        { type: 'text-delta', id: 'text-only', text: 'I will plan the lesson.' },
        { type: 'tool-result', toolCallId: 'state', toolName: 'read_classroom_state', output: { ok: true } },
      ]),
    })
    const { runLessonGenerationStep } = await import('./lesson-generation-runner')

    await expect(runLessonGenerationStep({
      config: { apiKey: 'test-key' } as Partial<LLMConfig>,
      toolkit: {} as Toolkit,
      bridge: {} as AIClassroomBridgeValue,
      event: { type: 'classroom_opened', createdAt: 1 },
    })).rejects.toThrow(/lesson_generation_failed/)
  })

  it('throws when orchestration tool only returns failWithRetryHint (ok:false) and never succeeds', async () => {
    streamMock.mockResolvedValueOnce({
      fullStream: createAsyncIterable([
        { type: 'tool-input-start', id: 'in', toolName: 'create_exercise_instance' },
        // Tool returns retry hint (ok: false) — should now count as failure (B-1)
        { type: 'tool-result', toolCallId: 'tool-hint', toolName: 'create_exercise_instance', output: { ok: false, error: 'zod validation failed', expectedShape: {} } },
      ]),
    })
    const { runLessonGenerationStep } = await import('./lesson-generation-runner')

    await expect(runLessonGenerationStep({
      config: { apiKey: 'test-key' } as Partial<LLMConfig>,
      toolkit: {} as Toolkit,
      bridge: {} as AIClassroomBridgeValue,
      event: { type: 'classroom_opened', createdAt: 1 },
    })).rejects.toThrow(/lesson_generation_failed/)
  })

  it('does not throw when only non-orchestration tool failed and orchestration succeeded', async () => {
    streamMock.mockResolvedValueOnce({
      fullStream: createAsyncIterable([
        { type: 'tool-input-start', id: 'in', toolName: 'read_classroom_state' },
        { type: 'tool-error', id: 'tool-err', toolName: 'read_classroom_state', error: new Error('boom') },
        { type: 'tool-input-start', id: 'in2', toolName: 'append_bridge_note' },
        { type: 'tool-result', toolCallId: 'tool-ok', toolName: 'append_bridge_note', output: { ok: true, appended: 1 } },
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

  it('drops reasoning-delta parts from learner-visible progress', async () => {
    streamMock.mockResolvedValueOnce({
      fullStream: createAsyncIterable([
        { type: 'reasoning-start', id: 'r-1' },
        { type: 'reasoning-delta', id: 'r-1', text: '我应该先读课堂状态' },
        { type: 'reasoning-delta', id: 'r-1', text: '，再决定教什么。' },
        { type: 'reasoning-end', id: 'r-1' },
        { type: 'tool-result', toolCallId: 'tool-1', toolName: 'append_content_reference_group', output: { ok: true, appended: 1 } },
      ]),
    })
    const { runLessonGenerationStep } = await import('./lesson-generation-runner')
    const progress: unknown[] = []

    await runLessonGenerationStep({
      config: { apiKey: 'test-key' } as Partial<LLMConfig>,
      toolkit: {} as Toolkit,
      bridge: {} as AIClassroomBridgeValue,
      event: { type: 'classroom_opened', createdAt: 1 },
      onProgress: chunk => progress.push(chunk),
    })

    expect(progress).toEqual([
      { type: 'tool-result', toolCallId: 'tool-1', toolName: 'append_content_reference_group', output: { ok: true, appended: 1 } },
    ])
  })

  it('drops all reasoning-delta chunks', async () => {
    streamMock.mockResolvedValueOnce({
      fullStream: createAsyncIterable([
        { type: 'reasoning-delta', id: 'r-1', text: '' },
        { type: 'reasoning-delta', id: 'r-1', text: 'actual content' },
        { type: 'tool-result', toolCallId: 'tool-1', toolName: 'append_content_reference_group', output: { ok: true, appended: 1 } },
      ]),
    })
    const { runLessonGenerationStep } = await import('./lesson-generation-runner')
    const progress: unknown[] = []

    await runLessonGenerationStep({
      config: { apiKey: 'test-key' } as Partial<LLMConfig>,
      toolkit: {} as Toolkit,
      bridge: {} as AIClassroomBridgeValue,
      event: { type: 'classroom_opened', createdAt: 1 },
      onProgress: chunk => progress.push(chunk),
    })

    const reasoningChunks = progress.filter((c): c is { type: 'reasoning', text: string } =>
      !!c && typeof c === 'object' && (c as { type?: string }).type === 'reasoning')
    expect(reasoningChunks.map(c => c.text)).toEqual([])
  })

  it('rethrows stream-level error parts instead of falling through to no-orchestration-output', async () => {
    const apiError = Object.assign(new Error('AI_APICallError: 用户额度不足, 剩余额度: $0'), {
      statusCode: 403,
      responseBody: '{"error":{"message":"用户额度不足","code":"insufficient_user_quota"}}',
    })
    streamMock.mockResolvedValueOnce({
      fullStream: createAsyncIterable([
        { type: 'text-delta', id: 'pre', text: 'I will try…' },
        { type: 'error', error: apiError },
      ]),
    })
    const { runLessonGenerationStep } = await import('./lesson-generation-runner')

    await expect(runLessonGenerationStep({
      config: { apiKey: 'test-key' } as Partial<LLMConfig>,
      toolkit: {} as Toolkit,
      bridge: {} as AIClassroomBridgeValue,
      event: { type: 'classroom_opened', createdAt: 1 },
    })).rejects.toBe(apiError)
  })

  it('wraps non-Error error payloads from error parts into Error instances', async () => {
    streamMock.mockResolvedValueOnce({
      fullStream: createAsyncIterable([
        { type: 'error', error: 'plain string failure' },
      ]),
    })
    const { runLessonGenerationStep } = await import('./lesson-generation-runner')

    await expect(runLessonGenerationStep({
      config: { apiKey: 'test-key' } as Partial<LLMConfig>,
      toolkit: {} as Toolkit,
      bridge: {} as AIClassroomBridgeValue,
      event: { type: 'classroom_opened', createdAt: 1 },
    })).rejects.toThrow(/plain string failure/)
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
    const progress: unknown[] = []

    await runLessonGenerationStep({
      config: { apiKey: 'test-key' } as Partial<LLMConfig>,
      toolkit: {} as Toolkit,
      bridge: {} as AIClassroomBridgeValue,
      event: { type: 'classroom_opened', createdAt: 1 },
      abortSignal: controller.signal,
      onProgress: chunk => progress.push(chunk),
    })

    expect(progress).toEqual([])
  })
})

async function* createAsyncIterable(parts: unknown[], afterFirst?: () => void) {
  for (const [index, part] of parts.entries()) {
    yield part
    if (index === 0)
      afterFirst?.()
  }
}
