import { describe, expect, it } from 'vitest'
import {
  createLessonAuthorEventEnvelope,
  LESSON_AUTHOR_SYSTEM_PROMPT,
  LESSON_AUTHOR_TOOL_NAMES,
} from './lesson-author-agent'

describe('lessonAuthorAgent contract', () => {
  it('keeps the system prompt prefix free of dynamic classroom state', () => {
    expect(LESSON_AUTHOR_SYSTEM_PROMPT).toContain('LessonAuthorAgent')
    expect(LESSON_AUTHOR_SYSTEM_PROMPT).toContain('DSL')

    for (const forbidden of [
      'currentQuiz:',
      'lastRun:',
      'stream:',
      'learner:',
      'main() {',
      'stdout:',
    ]) {
      expect(LESSON_AUTHOR_SYSTEM_PROMPT).not.toContain(forbidden)
    }
  })

  it('exposes only classroom-authoring tools to the lesson author', () => {
    expect(LESSON_AUTHOR_TOOL_NAMES).toEqual([
      'read_classroom_state',
      'read_concepts',
      'mcp_call_tool',
      'append_lesson_content',
      'set_current_quiz',
      'set_phase',
      'set_learning_notes',
    ])
    expect(LESSON_AUTHOR_TOOL_NAMES).not.toContain('highlight_editor_lines')
    expect(LESSON_AUTHOR_TOOL_NAMES).not.toContain('emit_classroom_event')
  })

  it('event envelopes do not include internal task or run identifiers', () => {
    const envelope = createLessonAuthorEventEnvelope({
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
