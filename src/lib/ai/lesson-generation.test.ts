/* eslint-disable prefer-arrow-callback */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildLessonGenerationSystemPrompt,
  createLessonGeneration,
  createLessonGenerationEventEnvelope,
  isLessonAuthoringTool,
  LESSON_AUTHORING_TOOL_NAMES,
  LESSON_GENERATION_SYSTEM_PROMPT,
  LESSON_GENERATION_TOOL_NAMES,
} from './lesson-generation'

const toolLoopAgentMock = vi.hoisted(() => vi.fn(function ToolLoopAgent(options: unknown) {
  return { options }
}))
const createConfiguredModelMock = vi.hoisted(() => vi.fn(() => ({ model: 'configured' })))
const toolkitToToolSetMock = vi.hoisted(() => vi.fn(() => ({ append_paragraph: { type: 'tool' } })))

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
      append_paragraph: {
        parameters: { type: 'object' },
        execute: () => ({}),
      },
    } as Parameters<typeof createLessonGeneration>[1]

    const generation = createLessonGeneration({ apiKey: 'key' }, toolkit, 'zh')

    expect(createConfiguredModelMock).toHaveBeenCalledWith({ apiKey: 'key' }, 'tour-lesson-generation')
    expect(toolkitToToolSetMock).toHaveBeenCalledWith(toolkit)
    expect(toolLoopAgentMock).toHaveBeenCalledWith({
      model: { model: 'configured' },
      instructions: buildLessonGenerationSystemPrompt('zh'),
      tools: { append_paragraph: { type: 'tool' } },
    })
    expect(generation).toEqual({
      options: expect.objectContaining({
        instructions: buildLessonGenerationSystemPrompt('zh'),
      }),
    })
  })

  it('adds the current user language to generation system instructions', () => {
    expect(buildLessonGenerationSystemPrompt('zh')).toContain('The learner is using zh')
    expect(buildLessonGenerationSystemPrompt('en')).toContain('The learner is using en')
  })

  it('lesson generation tool names list includes all 7 append_* tools and set_current_quiz', () => {
    expect(LESSON_GENERATION_TOOL_NAMES).toContain('read_lesson_outline')
    for (const name of [
      'append_heading',
      'append_paragraph',
      'append_concept_card',
      'append_code_example',
      'append_callout',
      'append_steps',
      'append_compare',
      'set_current_quiz',
    ] as const) {
      expect(LESSON_GENERATION_TOOL_NAMES).toContain(name)
    }
    expect(LESSON_GENERATION_TOOL_NAMES).not.toContain('append_lesson_content')
  })

  it('lesson authoring tool names cover all 8 lesson-content tools', () => {
    expect(LESSON_AUTHORING_TOOL_NAMES.size).toBe(8)
    for (const name of [
      'append_heading',
      'append_paragraph',
      'append_concept_card',
      'append_code_example',
      'append_callout',
      'append_steps',
      'append_compare',
      'set_current_quiz',
    ] as const) {
      expect(LESSON_AUTHORING_TOOL_NAMES.has(name)).toBe(true)
    }
  })

  it('lesson authoring tool names exclude read/control tools', () => {
    for (const name of ['read_classroom_state', 'read_concepts', 'mcp_call_tool', 'set_phase', 'set_learning_notes'] as const) {
      expect(isLessonAuthoringTool(name)).toBe(false)
    }
  })

  it('lesson generation system prompt mentions expectedShape and append_heading', () => {
    expect(LESSON_GENERATION_SYSTEM_PROMPT).toContain('append_heading')
    expect(LESSON_GENERATION_SYSTEM_PROMPT).toContain('read_lesson_outline')
    expect(LESSON_GENERATION_SYSTEM_PROMPT).toContain('expectedShape')
    expect(LESSON_GENERATION_SYSTEM_PROMPT).not.toContain('append_lesson_content')
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
