/* eslint-disable prefer-arrow-callback */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildLessonGenerationSystemPrompt,
  createLessonGeneration,
  createLessonGenerationEventEnvelope,
  LESSON_GENERATION_SYSTEM_PROMPT,
} from './lesson-generation'
import {
  evaluateLessonOrchestrationToolResult,
  isLessonOrchestrationTool,
  LESSON_GENERATION_TOOL_NAMES,
  LESSON_ORCHESTRATION_TOOL_NAMES,
} from '@/features/tour-ai/agent/toolkit/lesson-toolkit-metadata'

const toolLoopAgentMock = vi.hoisted(() => vi.fn(function ToolLoopAgent(options: unknown) {
  return { options }
}))
const createConfiguredModelMock = vi.hoisted(() => vi.fn(() => ({ model: 'configured' })))
const toolkitToToolSetMock = vi.hoisted(() => vi.fn(() => ({ append_content_reference_group: { type: 'tool' } })))

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
      append_content_reference_group: {
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
      tools: { append_content_reference_group: { type: 'tool' } },
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

  it('generation tool names include orchestration tools and no authoring tools', () => {
    for (const name of [
      'read_classroom_state',
      'read_lesson_outline',
      'read_course_content_pack',
      'append_content_reference_group',
      'append_bridge_note',
      'append_skip_marker',
      'create_exercise_instance',
      'save_clarification',
      'save_remediation',
    ] as const) {
      expect(LESSON_GENERATION_TOOL_NAMES).toContain(name)
    }
    expect(LESSON_GENERATION_TOOL_NAMES).not.toContain('append_heading')
    expect(LESSON_GENERATION_TOOL_NAMES).not.toContain('set_current_quiz')
    expect(LESSON_GENERATION_TOOL_NAMES).not.toContain('append_lesson_content')
  })

  it('orchestration tool name set covers only stream-mutating orchestration tools', () => {
    expect(LESSON_ORCHESTRATION_TOOL_NAMES).toEqual(new Set([
      'append_content_reference_group',
      'append_bridge_note',
      'append_skip_marker',
      'create_exercise_instance',
      'save_clarification',
      'save_remediation',
    ]))
    expect(isLessonOrchestrationTool('append_content_reference_group')).toBe(true)
    expect(isLessonOrchestrationTool('read_course_content_pack')).toBe(false)
    expect(isLessonOrchestrationTool('append_heading')).toBe(false)
  })

  it('orchestration success criteria live with the lesson toolkit metadata', () => {
    expect(evaluateLessonOrchestrationToolResult('append_bridge_note', { ok: true })).toEqual({
      orchestration: true,
      succeeded: true,
    })
    expect(evaluateLessonOrchestrationToolResult('append_bridge_note', { ok: false, error: 'retry with a valid concept' })).toEqual({
      orchestration: true,
      succeeded: false,
      failureDetail: 'retry with a valid concept',
    })
    expect(evaluateLessonOrchestrationToolResult('read_course_content_pack', { ok: true })).toEqual({
      orchestration: false,
    })
  })

  it('system prompt describes reusable content references and excludes old authoring vocabulary', () => {
    expect(LESSON_GENERATION_SYSTEM_PROMPT).toContain('Course Content Pack')
    expect(LESSON_GENERATION_SYSTEM_PROMPT).toContain('append_content_reference_group')
    expect(LESSON_GENERATION_SYSTEM_PROMPT).toContain('create_exercise_instance')
    expect(LESSON_GENERATION_SYSTEM_PROMPT).toContain('bounded Personalization Inputs')
    expect(LESSON_GENERATION_SYSTEM_PROMPT).toContain('exerciseIntent is review_check')
    expect(LESSON_GENERATION_SYSTEM_PROMPT).toContain('without advancing the mainline track')
    expect(LESSON_GENERATION_SYSTEM_PROMPT).toContain('never author prompt, starter code, expected output')
    expect(LESSON_GENERATION_SYSTEM_PROMPT).not.toContain('append_heading')
    expect(LESSON_GENERATION_SYSTEM_PROMPT).not.toContain('set_current_quiz')
    expect(LESSON_GENERATION_SYSTEM_PROMPT).not.toContain('currentQuiz:')
  })

  it('event envelopes do not include internal task or run identifiers', () => {
    const envelope = createLessonGenerationEventEnvelope({
      type: 'exercise_success',
      exerciseInstanceId: 'exercise:1',
      exerciseIntent: 'review_check',
      skillId: 'cj.io.println.print-value',
      conceptIds: ['cj.io.println'],
      summary: 'Exercise completed successfully.',
      createdAt: 1000,
    })

    expect(envelope).toEqual({
      event: {
        type: 'exercise_success',
        exerciseInstanceId: 'exercise:1',
        exerciseIntent: 'review_check',
        skillId: 'cj.io.println.print-value',
        conceptIds: ['cj.io.println'],
        summary: 'Exercise completed successfully.',
        createdAt: 1000,
      },
    })
    expect(JSON.stringify(envelope)).not.toContain('taskId')
    expect(JSON.stringify(envelope)).not.toContain('runId')
  })
})
