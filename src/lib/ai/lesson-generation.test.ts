/* eslint-disable prefer-arrow-callback */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createLessonGeneration,
  createLessonGenerationEventEnvelope,
  LESSON_GENERATION_SYSTEM_PROMPT,
} from './lesson-generation'

const toolLoopAgentMock = vi.hoisted(() => vi.fn(function ToolLoopAgent(options: unknown) {
  return { options }
}))
const createConfiguredModelMock = vi.hoisted(() => vi.fn(() => ({ model: 'configured' })))
const toolkitToToolSetMock = vi.hoisted(() => vi.fn(() => ({ append_lesson_content: { type: 'tool' } })))

vi.mock('ai', () => ({
  ToolLoopAgent: toolLoopAgentMock,
}))

vi.mock('./model-provider', () => ({
  createConfiguredModel: createConfiguredModelMock,
}))

vi.mock('./toolkit-to-tool-set', () => ({
  toolkitToToolSet: toolkitToToolSetMock,
}))

describe('lesson generation contract', () => {
  beforeEach(() => {
    toolLoopAgentMock.mockClear()
    createConfiguredModelMock.mockClear()
    toolkitToToolSetMock.mockClear()
  })

  it('constructs lesson generation with the generation model name and converted tools', () => {
    const toolkit = {
      append_lesson_content: {
        parameters: { type: 'object' },
        execute: () => ({}),
      },
    } as Parameters<typeof createLessonGeneration>[1]

    const generation = createLessonGeneration({ apiKey: 'key' }, toolkit)

    expect(createConfiguredModelMock).toHaveBeenCalledWith({ apiKey: 'key' }, 'tour-lesson-generation')
    expect(toolkitToToolSetMock).toHaveBeenCalledWith(toolkit)
    expect(toolLoopAgentMock).toHaveBeenCalledWith({
      model: { model: 'configured' },
      instructions: LESSON_GENERATION_SYSTEM_PROMPT,
      tools: { append_lesson_content: { type: 'tool' } },
    })
    expect(generation).toEqual({
      options: expect.objectContaining({
        instructions: LESSON_GENERATION_SYSTEM_PROMPT,
      }),
    })
  })

  it('keeps the system prompt prefix free of dynamic classroom state', () => {
    for (const forbidden of [
      'currentQuiz:',
      'lastRun:',
      'stream:',
      'learner:',
      'main() {',
      'stdout:',
    ]) {
      expect(LESSON_GENERATION_SYSTEM_PROMPT).not.toContain(forbidden)
    }
  })

  it('event envelopes do not include internal task or run identifiers', () => {
    const envelope = createLessonGenerationEventEnvelope({
      type: 'quiz_success',
      conceptId: 'cj.bindings.let',
      summary: 'Quiz completed successfully for cj.bindings.let.',
      createdAt: 1000,
    })

    expect(envelope).toEqual({
      event: {
        type: 'quiz_success',
        conceptId: 'cj.bindings.let',
        summary: 'Quiz completed successfully for cj.bindings.let.',
        createdAt: 1000,
      },
    })
    expect(JSON.stringify(envelope)).not.toContain('taskId')
    expect(JSON.stringify(envelope)).not.toContain('runId')
  })
})
