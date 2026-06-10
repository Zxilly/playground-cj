import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import { classroomReducer, createInitialClassroomSession } from '@/lib/ai/classroom/reducer'
import type { ClassroomAction } from '@/lib/ai/classroom/reducer'
import type { ClassroomSession } from '@/lib/ai/classroom/types'
import type { ConceptValidationStatus } from '@/lib/ai/course-content/types'
import { getDefaultCourseContentIndex } from '@/lib/ai/course-content/loader'
import {
  LESSON_GENERATION_TOOL_NAMES,
  LESSON_ORCHESTRATION_TOOL_NAMES,
} from './toolkit/create-lesson-generation-toolkit'
import { LESSON_ORCHESTRATION_COMMANDS } from './toolkit/lesson-orchestration-commands'

vi.mock('@codingame/monaco-vscode-editor-api', () => ({
  editor: {
    setModelMarkers: vi.fn(),
    getEditors: () => [],
    getModel: () => null,
    getModels: () => [],
  },
  Uri: {
    parse: (s: string) => ({ toString: () => s }),
  },
  MarkerSeverity: {
    Hint: 1,
    Info: 2,
    Warning: 4,
    Error: 8,
  },
  Range: class {
    constructor(
      public startLineNumber: number,
      public startColumn: number,
      public endLineNumber: number,
      public endColumn: number,
    ) {}
  },
}))

const listMcpToolsMock = vi.hoisted(() => vi.fn())
const callMcpToolMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/mcp/client', () => ({
  listMcpTools: listMcpToolsMock,
  callMcpTool: callMcpToolMock,
}))

let session: ClassroomSession = createInitialClassroomSession({ lang: 'zh' })
const dispatch = vi.fn((action: ClassroomAction) => {
  session = classroomReducer(session, action)
})
const replaceChatAnnotations = vi.fn()
const clearChatAnnotations = vi.fn()

const model = {
  getValue: () => 'main() {\n    println(3)\n}',
  getLineCount: () => 3,
  getLineContent: (line: number) => line === 2 ? '    println(3)' : '',
  getLineMaxColumn: () => 15,
  getLanguageId: () => 'cangjie',
  getVersionId: () => 7,
  uri: 'inmemory://test.cj',
}

const editor = {
  getModel: () => model,
  revealLineInCenter: vi.fn(),
}

const bridge = {
  lang: 'zh',
  uiLang: 'zh',
  editor: {
    getEditor: () => editor,
    setEditor: vi.fn(),
  },
  classroom: {
    getSession: () => session,
    dispatch,
    replaceChatAnnotations,
    clearChatAnnotations,
  },
} as unknown as AIClassroomBridgeValue

async function withConceptStatus<T>(conceptId: string, status: ConceptValidationStatus, callback: () => Promise<T>): Promise<T> {
  const statuses = getDefaultCourseContentIndex().validation.conceptStatuses
  const original = statuses[conceptId]
  statuses[conceptId] = status
  try {
    return await callback()
  }
  finally {
    if (original == null)
      delete statuses[conceptId]
    else
      statuses[conceptId] = original
  }
}

afterEach(() => {
  session = createInitialClassroomSession({ lang: 'zh' })
  dispatch.mockClear()
  replaceChatAnnotations.mockClear()
  clearChatAnnotations.mockClear()
  editor.revealLineInCenter.mockClear()
  listMcpToolsMock.mockReset()
  callMcpToolMock.mockReset()
})

describe('ai classroom toolkits', () => {
  it('chat toolkit exposes chat-safe tools plus explicit retention', async () => {
    const { createClassroomChatToolkit } = await import('./tools')
    const toolkit = createClassroomChatToolkit(bridge)

    expect(Object.keys(toolkit).sort()).toEqual([
      'clear_editor_annotations',
      'emit_classroom_event',
      'highlight_editor_lines',
      'mcp_call_tool',
      'read_classroom_state',
      'read_concepts',
      'read_course_content_pack',
      'read_current_exercise',
      'read_editor_code',
      'read_last_run',
      'read_lesson_outline',
      'read_review_artifact_groups',
      'reveal_editor_line',
      'save_clarification',
      'suggest_code_change',
      'underline_editor_range',
    ].sort())
    expect(toolkit.append_content_reference_group).toBeUndefined()
    expect(toolkit.create_exercise_instance).toBeUndefined()
  })

  it('lesson generation toolkit exposes orchestration tools, not authoring tools', async () => {
    const { createLessonGenerationToolkit } = await import('./tools')
    const toolkit = createLessonGenerationToolkit(bridge)

    expect(Object.keys(toolkit).sort()).toEqual([...LESSON_GENERATION_TOOL_NAMES].sort())
    for (const name of LESSON_ORCHESTRATION_TOOL_NAMES)
      expect(toolkit[name]).toBeDefined()
    expect(toolkit.append_heading).toBeUndefined()
    expect(toolkit.set_current_quiz).toBeUndefined()
  })

  it('lesson orchestration command definitions match the mutating tool metadata', () => {
    expect(LESSON_ORCHESTRATION_COMMANDS.map(command => command.name).sort())
      .toEqual([...LESSON_ORCHESTRATION_TOOL_NAMES].sort())
  })

  it('orchestration tools append content references and exercise instances', async () => {
    const { createLessonGenerationToolkit } = await import('./tools')
    const toolkit = createLessonGenerationToolkit(bridge)

    await toolkit.append_content_reference_group!.execute!({
      conceptId: 'cj.io.println',
      blockIds: ['cj.io.println.heading'],
      skillId: 'cj.io.println.print-value',
    }, toolOptions())
    await toolkit.create_exercise_instance!.execute!({
      templateId: 'cj.io.println.print-value.cangjie',
    }, toolOptions())

    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'APPEND_CONTENT_REFERENCE_GROUP',
      conceptId: 'cj.io.println',
    }))
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'CREATE_EXERCISE_INSTANCE',
      exercise: expect.objectContaining({
        templateId: 'cj.io.println.print-value.cangjie',
        skillId: 'cj.io.println.print-value',
        prompt: '在 main 中用 println 输出 Cangjie。',
        starterCode: 'main() {\n    // TODO\n}',
        expectedOutput: 'Cangjie',
      }),
    }))
  })

  it('orchestration save_clarification reports retained concept metadata without progress effects', async () => {
    const { createLessonGenerationToolkit } = await import('./tools')
    const toolkit = createLessonGenerationToolkit(bridge)

    const result = await toolkit.save_clarification!.execute!({
      conceptId: 'cj.io.println',
      title: 'Why println',
      body: 'Use println for console output.',
      summary: 'println reminder',
    }, toolOptions())

    expect(result).toMatchObject({
      ok: true,
      retained: true,
      conceptId: 'cj.io.println',
      conceptStatus: 'validated',
      artifactKind: 'clarification',
      progressEffect: 'does_not_update_concept_progress',
    })
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SAVE_REVIEW_ARTIFACT',
      artifact: expect.objectContaining({
        kind: 'clarification',
        conceptId: 'cj.io.println',
        evidenceIds: [],
      }),
    }))
  })

  it('orchestration save_clarification preserves read-only content as read-only review material', async () => {
    await withConceptStatus('cj.io.println', 'read_only', async () => {
      const { createLessonGenerationToolkit } = await import('./tools')
      const toolkit = createLessonGenerationToolkit(bridge)

      const result = await toolkit.save_clarification!.execute!({
        conceptId: 'cj.io.println',
        title: 'Static note',
        body: 'This concept can be explained but not used for progress-driving practice.',
        summary: 'read-only reminder',
      }, toolOptions())

      expect(result).toMatchObject({
        ok: true,
        retained: true,
        conceptId: 'cj.io.println',
        conceptStatus: 'read_only',
        artifactKind: 'read_only_clarification',
        progressEffect: 'does_not_update_concept_progress',
      })
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        type: 'SAVE_REVIEW_ARTIFACT',
        artifact: expect.objectContaining({
          kind: 'read_only_clarification',
          conceptId: 'cj.io.println',
        }),
      }))
    })
  })

  it('orchestration save_clarification refuses unavailable concepts without retaining review material', async () => {
    const { createLessonGenerationToolkit } = await import('./tools')
    const toolkit = createLessonGenerationToolkit(bridge)

    const result = await toolkit.save_clarification!.execute!({
      conceptId: 'cj.out-of-pack.topic',
      title: 'Outside the pack',
      body: 'This answer can help now, but should not become retained review material.',
      summary: 'outside pack answer',
    }, toolOptions())

    expect(result).toMatchObject({ ok: false })
    expect((result as { error: string }).error).toContain('not available for retained Review Artifacts')
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({
      type: 'SAVE_REVIEW_ARTIFACT',
    }))
  })

  it('create_exercise_instance rejects model-authored task text', async () => {
    const { createLessonGenerationToolkit } = await import('./tools')
    const toolkit = createLessonGenerationToolkit(bridge)

    const result = await toolkit.create_exercise_instance!.execute!({
      templateId: 'cj.io.println.print-value.cangjie',
      prompt: 'Print arbitrary text.',
      starterCode: 'main() {}',
      expectedOutput: 'anything',
    }, toolOptions())

    expect(result).toMatchObject({ ok: false })
    expect((result as { error: string }).error).toContain('Unrecognized')
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({
      type: 'CREATE_EXERCISE_INSTANCE',
    }))
  })

  it('create_exercise_instance refuses to supersede the active exercise', async () => {
    session = classroomReducer(session, {
      type: 'CREATE_EXERCISE_INSTANCE',
      exercise: {
        templateId: 'cj.io.println.print-value.cangjie',
        templateVersion: '2026-05-28',
        skillId: 'cj.io.println.print-value',
        conceptIds: ['cj.io.println'],
        prompt: 'Print 7.',
        starterCode: 'main() {\n    // write here\n}',
        expectedOutput: '7',
        matchMode: 'exact',
        intent: 'mainline',
        personalizationInputs: { summary: 'test' },
      },
      now: 1001,
    })
    dispatch.mockClear()

    const { createLessonGenerationToolkit } = await import('./tools')
    const toolkit = createLessonGenerationToolkit(bridge)

    const result = await toolkit.create_exercise_instance!.execute!({
      templateId: 'cj.io.println.print-value.cangjie',
    }, toolOptions())

    expect(result).toMatchObject({ ok: false })
    expect((result as { error: string }).error).toContain('active')
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({
      type: 'CREATE_EXERCISE_INSTANCE',
    }))
  })

  it('orchestration tools can create a template-backed review check instance', async () => {
    const { createLessonGenerationToolkit } = await import('./tools')
    const toolkit = createLessonGenerationToolkit(bridge)

    const result = await toolkit.create_exercise_instance!.execute!({
      templateId: 'cj.io.println.print-value.cangjie',
      intent: 'review_check',
    }, toolOptions())

    expect(result).toMatchObject({ ok: true, intent: 'review_check' })
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'CREATE_EXERCISE_INSTANCE',
      exercise: expect.objectContaining({
        templateId: 'cj.io.println.print-value.cangjie',
        prompt: '在 main 中用 println 输出 Cangjie。',
        intent: 'review_check',
      }),
    }))
  })

  it('save_remediation links to the latest matching failure evidence when evidence ids are omitted', async () => {
    session = classroomReducer(session, {
      type: 'CREATE_EXERCISE_INSTANCE',
      exercise: {
        templateId: 'cj.io.println.print-value.cangjie',
        templateVersion: '2026-05-28',
        skillId: 'cj.io.println.print-value',
        conceptIds: ['cj.io.println'],
        prompt: 'Print Cangjie.',
        starterCode: 'main() {\n    // TODO\n}',
        expectedOutput: 'Cangjie',
        matchMode: 'exact',
        intent: 'mainline',
        personalizationInputs: { summary: 'test' },
      },
      now: 1001,
    })
    session = classroomReducer(session, {
      type: 'EXERCISE_SUBMIT_FINISHED',
      result: {
        ok: true,
        stdout: 'wrong\n',
        stderr: '',
        exitCode: 0,
      },
      attemptedCode: 'main() { println("wrong") }',
      now: 1002,
    })
    dispatch.mockClear()

    const { createLessonGenerationToolkit } = await import('./tools')
    const toolkit = createLessonGenerationToolkit(bridge)

    const result = await toolkit.save_remediation!.execute!({
      conceptId: 'cj.io.println',
      skillId: 'cj.io.println.print-value',
      title: 'Output mismatch',
      body: 'Compare the exact expected stdout before submitting again.',
      summary: 'stdout mismatch',
    }, toolOptions())

    expect(result).toMatchObject({ ok: true })
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SAVE_REVIEW_ARTIFACT',
      artifact: expect.objectContaining({
        kind: 'remediation',
        conceptId: 'cj.io.println',
        skillId: 'cj.io.println.print-value',
        evidenceIds: ['evidence:1002:0'],
      }),
    }))
  })

  it('save_remediation rejects review content that is not backed by failure evidence', async () => {
    const { createLessonGenerationToolkit } = await import('./tools')
    const toolkit = createLessonGenerationToolkit(bridge)

    const result = await toolkit.save_remediation!.execute!({
      conceptId: 'cj.io.println',
      skillId: 'cj.io.println.print-value',
      title: 'No failed attempt',
      body: 'This should be a clarification unless a real attempt failed.',
      summary: 'unbacked remediation',
    }, toolOptions())

    expect(result).toMatchObject({ ok: false })
    expect((result as { error: string }).error).toContain('failure evidence')
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({
      type: 'SAVE_REVIEW_ARTIFACT',
    }))
  })

  it('save_remediation rejects dangling explicit evidence ids', async () => {
    session = classroomReducer(session, {
      type: 'CREATE_EXERCISE_INSTANCE',
      exercise: {
        templateId: 'cj.io.println.print-value.cangjie',
        templateVersion: '2026-05-28',
        skillId: 'cj.io.println.print-value',
        conceptIds: ['cj.io.println'],
        prompt: 'Print Cangjie.',
        starterCode: 'main() {\n    // TODO\n}',
        expectedOutput: 'Cangjie',
        matchMode: 'exact',
        intent: 'mainline',
        personalizationInputs: { summary: 'test' },
      },
      now: 1001,
    })
    session = classroomReducer(session, {
      type: 'EXERCISE_SUBMIT_FINISHED',
      result: {
        ok: true,
        stdout: 'wrong\n',
        stderr: '',
        exitCode: 0,
      },
      attemptedCode: 'main() { println("wrong") }',
      now: 1002,
    })
    dispatch.mockClear()

    const { createLessonGenerationToolkit } = await import('./tools')
    const toolkit = createLessonGenerationToolkit(bridge)

    const result = await toolkit.save_remediation!.execute!({
      conceptId: 'cj.io.println',
      skillId: 'cj.io.println.print-value',
      title: 'Output mismatch',
      body: 'Compare the exact expected stdout before submitting again.',
      summary: 'stdout mismatch',
      evidenceIds: ['evidence:1002:0', 'missing-evidence'],
    }, toolOptions())

    expect(result).toMatchObject({ ok: false })
    expect((result as { error: string }).error).toContain('evidenceIds')
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({
      type: 'SAVE_REVIEW_ARTIFACT',
    }))
  })

  it('read_course_content_pack exposes validated pack metadata for a concept', async () => {
    const { createLessonGenerationToolkit } = await import('./tools')
    const toolkit = createLessonGenerationToolkit(bridge)

    const result = await toolkit.read_course_content_pack!.execute!({
      conceptId: 'cj.io.println',
      skillId: 'cj.io.println.print-value',
    }, toolOptions())

    expect(result).toMatchObject({
      ok: true,
      packId: 'default-entry',
    })
    expect((result as { concepts: Array<{ conceptId: string }> }).concepts)
      .toContainEqual(expect.objectContaining({ conceptId: 'cj.io.println' }))
    expect((result as { blocks: Array<{ blockId: string }> }).blocks)
      .toContainEqual(expect.objectContaining({ blockId: 'cj.io.println.heading' }))
    expect((result as { exerciseTemplates: Array<{ templateId: string }> }).exerciseTemplates)
      .toContainEqual(expect.objectContaining({ templateId: 'cj.io.println.print-value.cangjie' }))
  })

  it('read_course_content_pack includes concept exercise templates without requiring a separate skill id', async () => {
    const { createLessonGenerationToolkit } = await import('./tools')
    const toolkit = createLessonGenerationToolkit(bridge)

    const result = await toolkit.read_course_content_pack!.execute!({
      conceptId: 'cj.program.main',
    }, toolOptions())

    expect(result).toMatchObject({ ok: true })
    expect((result as { skills: Array<{ skillId: string }> }).skills)
      .toContainEqual(expect.objectContaining({ skillId: 'cj.program.main.write-entry' }))
    expect((result as { exerciseTemplates: Array<{ templateId: string }> }).exerciseTemplates)
      .toContainEqual(expect.objectContaining({ templateId: 'cj.program.main.write-entry.hello' }))
  })

  it('read_course_content_pack hides practice templates for read-only content', async () => {
    await withConceptStatus('cj.io.println', 'read_only', async () => {
      const { createLessonGenerationToolkit } = await import('./tools')
      const toolkit = createLessonGenerationToolkit(bridge)

      const result = await toolkit.read_course_content_pack!.execute!({
        conceptId: 'cj.io.println',
        skillId: 'cj.io.println.print-value',
      }, toolOptions())

      expect(result).toMatchObject({
        ok: true,
        packId: 'default-entry',
      })
      expect((result as { blocks: Array<{ blockId: string }> }).blocks)
        .toContainEqual(expect.objectContaining({ blockId: 'cj.io.println.heading' }))
      expect((result as { exerciseTemplates: Array<{ templateId: string }> }).exerciseTemplates)
        .toEqual([])
    })
  })

  it('chat can retain a clarification scoped to the active concept', async () => {
    const { createClassroomChatToolkit } = await import('./tools')
    const toolkit = createClassroomChatToolkit(bridge, { activeConceptId: 'cj.io.println' })

    const result = await toolkit.save_clarification!.execute!({
      title: 'Why println',
      body: 'Use println for console output.',
      summary: 'println reminder',
    }, toolOptions())

    expect(result).toMatchObject({
      ok: true,
      retained: true,
      conceptId: 'cj.io.println',
      conceptStatus: 'validated',
      artifactKind: 'clarification',
      progressEffect: 'does_not_update_concept_progress',
    })
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SAVE_REVIEW_ARTIFACT',
      artifact: expect.objectContaining({
        kind: 'clarification',
        conceptId: 'cj.io.println',
      }),
    }))
  })

  it('chat refuses to retain a clarification for unavailable concepts', async () => {
    const { createClassroomChatToolkit } = await import('./tools')
    const toolkit = createClassroomChatToolkit(bridge, { activeConceptId: 'cj.io.println' })

    const result = await toolkit.save_clarification!.execute!({
      conceptId: 'cj.out-of-pack.topic',
      title: 'Outside the pack',
      body: 'This chat answer can help now, but should not become retained review material.',
      summary: 'outside pack answer',
    }, toolOptions())

    expect(result).toMatchObject({ ok: false })
    expect((result as { error: string }).error).toContain('not available')
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({
      type: 'SAVE_REVIEW_ARTIFACT',
    }))
  })

  it('chat emits lesson intents scoped to the active concept', async () => {
    const { createClassroomChatToolkit } = await import('./tools')
    const toolkit = createClassroomChatToolkit(bridge, { activeConceptId: 'cj.io.println' })

    const result = await toolkit.emit_classroom_event!.execute!({
      intent: 'go_deeper',
      summary: 'Learner wants more detail here.',
    }, toolOptions())

    expect(result).toMatchObject({ ok: true })
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'EMIT_CHAT_INTENT',
      intent: 'go_deeper',
      activeConceptId: 'cj.io.println',
    }))
    expect(session.eventQueue[0]).toMatchObject({
      type: 'chat_intent',
      activeConceptId: 'cj.io.println',
    })
  })

  it('chat can emit a concept-scoped review check intent', async () => {
    const { createClassroomChatToolkit } = await import('./tools')
    const toolkit = createClassroomChatToolkit(bridge, { activeConceptId: 'cj.io.println' })

    const result = await toolkit.emit_classroom_event!.execute!({
      intent: 'review_check',
      summary: 'Learner wants a review check for this concept.',
    }, toolOptions())

    expect(result).toMatchObject({ ok: true })
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'EMIT_CHAT_INTENT',
      intent: 'review_check',
      activeConceptId: 'cj.io.println',
    }))
  })

  it('chat refuses to queue classroom events for unavailable active concepts', async () => {
    const { createClassroomChatToolkit } = await import('./tools')
    const toolkit = createClassroomChatToolkit(bridge, { activeConceptId: 'cj.out-of-pack.topic' })

    const result = await toolkit.emit_classroom_event!.execute!({
      intent: 'go_deeper',
      summary: 'Learner wants out-of-pack help.',
    }, toolOptions())

    expect(result).toMatchObject({ ok: false })
    expect((result as { error: string }).error).toContain('not available')
    expect((result as { error: string }).error).toContain('Answer directly in Chat')
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({
      type: 'EMIT_CHAT_INTENT',
    }))
    expect(session.eventQueue).toEqual([])
  })

  it('chat keeps read-only concept help out of progress-driving events', async () => {
    await withConceptStatus('cj.io.println', 'read_only', async () => {
      const { createClassroomChatToolkit } = await import('./tools')
      const toolkit = createClassroomChatToolkit(bridge, { activeConceptId: 'cj.io.println' })

      const reviewCheck = await toolkit.emit_classroom_event!.execute!({
        intent: 'review_check',
        summary: 'Learner wants a review check for read-only content.',
      }, toolOptions())

      expect(reviewCheck).toMatchObject({ ok: false })
      expect((reviewCheck as { error: string }).error).toContain('read-only concept')
      expect((reviewCheck as { error: string }).error).toContain('cannot drive mainline progress')
      expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({
        type: 'EMIT_CHAT_INTENT',
      }))

      const explanation = await toolkit.emit_classroom_event!.execute!({
        intent: 'go_deeper',
        summary: 'Learner wants a deeper explanation of read-only content.',
      }, toolOptions())

      expect(explanation).toMatchObject({ ok: true })
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        type: 'EMIT_CHAT_INTENT',
        intent: 'go_deeper',
        activeConceptId: 'cj.io.println',
      }))
    })
  })

  it('chat does not advance, change topic, or queue review checks over an active exercise', async () => {
    session = classroomReducer(session, {
      type: 'CREATE_EXERCISE_INSTANCE',
      exercise: {
        templateId: 'cj.io.println.print-value.cangjie',
        templateVersion: '2026-05-28',
        skillId: 'cj.io.println.print-value',
        conceptIds: ['cj.io.println'],
        prompt: 'Print 7.',
        starterCode: 'main() {\n    // write here\n}',
        expectedOutput: '7',
        matchMode: 'exact',
        intent: 'mainline',
        personalizationInputs: { summary: 'test' },
      },
      now: 1001,
    })
    dispatch.mockClear()

    const { createClassroomChatToolkit } = await import('./tools')
    const toolkit = createClassroomChatToolkit(bridge, { activeConceptId: 'cj.io.println' })

    for (const intent of ['advance', 'change_topic', 'review_check'] as const) {
      const result = await toolkit.emit_classroom_event!.execute!({
        intent,
        summary: `Learner requested ${intent}.`,
      }, toolOptions())

      expect(result).toMatchObject({ ok: false })
      expect((result as { error: string }).error).toContain('active')
    }

    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'EMIT_CHAT_INTENT' }))
    expect(session.eventQueue).toEqual([])
  })

  it('chat still allows help intents while an exercise is active', async () => {
    session = classroomReducer(session, {
      type: 'CREATE_EXERCISE_INSTANCE',
      exercise: {
        templateId: 'cj.io.println.print-value.cangjie',
        templateVersion: '2026-05-28',
        skillId: 'cj.io.println.print-value',
        conceptIds: ['cj.io.println'],
        prompt: 'Print 7.',
        starterCode: 'main() {\n    // write here\n}',
        expectedOutput: '7',
        matchMode: 'exact',
        intent: 'mainline',
        personalizationInputs: { summary: 'test' },
      },
      now: 1001,
    })
    dispatch.mockClear()

    const { createClassroomChatToolkit } = await import('./tools')
    const toolkit = createClassroomChatToolkit(bridge, { activeConceptId: 'cj.io.println' })

    const result = await toolkit.emit_classroom_event!.execute!({
      intent: 'explain_error',
      summary: 'Learner wants help with the current exercise.',
    }, toolOptions())

    expect(result).toMatchObject({ ok: true })
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'EMIT_CHAT_INTENT',
      intent: 'explain_error',
      activeConceptId: 'cj.io.println',
    }))
    expect(session.eventQueue[0]).toMatchObject({
      type: 'chat_intent',
      intent: 'explain_error',
      activeConceptId: 'cj.io.println',
    })
  })

  it('chat does not stack another classroom event while generation is already queued', async () => {
    session = classroomReducer(session, {
      type: 'EMIT_CHAT_INTENT',
      intent: 'go_deeper',
      summary: 'First queued request.',
      activeConceptId: 'cj.io.println',
      now: 1001,
    })
    dispatch.mockClear()

    const { createClassroomChatToolkit } = await import('./tools')
    const toolkit = createClassroomChatToolkit(bridge, { activeConceptId: 'cj.io.println' })

    const result = await toolkit.emit_classroom_event!.execute!({
      intent: 'slow_down',
      summary: 'Second queued request.',
    }, toolOptions())

    expect(result).toMatchObject({ ok: false })
    expect((result as { error: string }).error).toContain('already preparing')
    expect(dispatch).not.toHaveBeenCalled()
    expect(session.eventQueue).toHaveLength(1)
  })

  it('read_editor_code falls back to starter code from the active exercise', async () => {
    session = classroomReducer(session, {
      type: 'CREATE_EXERCISE_INSTANCE',
      exercise: {
        templateId: 'cj.io.println.print-value.cangjie',
        templateVersion: '2026-05-28',
        skillId: 'cj.io.println.print-value',
        conceptIds: ['cj.io.println'],
        prompt: 'Print 7.',
        starterCode: 'main() {\n    // write here\n}',
        expectedOutput: '7',
        matchMode: 'exact',
        intent: 'mainline',
        personalizationInputs: { summary: 'test' },
      },
      now: 1001,
    })

    const { createClassroomChatToolkit } = await import('./tools')
    const toolkit = createClassroomChatToolkit({
      ...bridge,
      editor: { getEditor: () => null, setEditor: vi.fn() },
    } as unknown as AIClassroomBridgeValue)

    const result = await toolkit.read_editor_code!.execute!({}, toolOptions())

    expect(result).toMatchObject({
      ok: true,
      code: 'main() {\n    // write here\n}',
      source: 'starter',
      stale: true,
      exerciseId: session.currentExercise?.id,
    })
  })

  it('suggest_code_change stages a suggestion only for the active exercise', async () => {
    const { useCodeSuggestionStore } = await import('@/features/tour-ai/state/code-suggestion-store')
    useCodeSuggestionStore.setState({ suggestion: null })
    session = classroomReducer(session, {
      type: 'CREATE_EXERCISE_INSTANCE',
      exercise: {
        templateId: 'cj.io.println.print-value.cangjie',
        templateVersion: '2026-05-28',
        skillId: 'cj.io.println.print-value',
        conceptIds: ['cj.io.println'],
        prompt: 'p',
        starterCode: '',
        expectedOutput: '7',
        matchMode: 'exact',
        intent: 'mainline',
        personalizationInputs: { summary: 'test' },
      },
      now: 1001,
    })
    const active = session.currentExercise!
    const { createClassroomChatToolkit } = await import('./tools')
    const toolkit = createClassroomChatToolkit(bridge)

    await expect(toolkit.suggest_code_change!.execute!({
      exerciseId: 'wrong-id',
      code: 'main() {}',
      explanation: 'wrong target',
    }, toolOptions())).resolves.toMatchObject({ ok: false })

    await expect(toolkit.suggest_code_change!.execute!({
      exerciseId: active.id,
      code: 'main() { println(7) }',
      explanation: 'matches expected output.',
    }, toolOptions())).resolves.toMatchObject({ ok: true, staged: true })
    expect(useCodeSuggestionStore.getState().suggestion).toMatchObject({
      exerciseId: active.id,
      code: 'main() { println(7) }',
    })
    useCodeSuggestionStore.setState({ suggestion: null })
  })

  it('editor annotation tools write and clear Monaco chat markers', async () => {
    const { createClassroomChatToolkit } = await import('./tools')
    const toolkit = createClassroomChatToolkit(bridge)
    const monaco = await import('@codingame/monaco-vscode-editor-api')

    await toolkit.highlight_editor_lines!.execute!({ startLine: 2, label: 'print' }, toolOptions())
    await toolkit.clear_editor_annotations!.execute!({}, toolOptions())

    expect(replaceChatAnnotations).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: 'highlight',
        targetSnippet: 'println(3)',
      }),
    ])
    expect(clearChatAnnotations).toHaveBeenCalled()
    expect(monaco.editor.setModelMarkers).toHaveBeenLastCalledWith(model, 'chat', [])
  })

  it('editor annotation tools reject invalid ranges without writing markers', async () => {
    const { createClassroomChatToolkit } = await import('./tools')
    const toolkit = createClassroomChatToolkit(bridge)
    const monaco = await import('@codingame/monaco-vscode-editor-api')
    vi.mocked(monaco.editor.setModelMarkers).mockClear()

    const outOfBounds = await toolkit.highlight_editor_lines!.execute!({
      startLine: 4,
      label: 'missing line',
    }, toolOptions())
    const reversedRange = await toolkit.underline_editor_range!.execute!({
      startLine: 2,
      startColumn: 10,
      endLine: 2,
      endColumn: 3,
      label: 'reversed',
    }, toolOptions())

    expect(outOfBounds).toMatchObject({ ok: false })
    expect((outOfBounds as { error: string }).error).toContain('outside')
    expect(reversedRange).toMatchObject({ ok: false })
    expect((reversedRange as { error: string }).error).toContain('endColumn')
    expect(replaceChatAnnotations).not.toHaveBeenCalled()
    expect(monaco.editor.setModelMarkers).not.toHaveBeenCalled()
  })

  it('mcp_call_tool only calls tools returned by discovery', async () => {
    listMcpToolsMock.mockResolvedValueOnce([
      { name: 'docs.search', description: 'Search docs', inputSchema: { type: 'object' } },
    ])
    callMcpToolMock.mockResolvedValueOnce({ hits: 1 })
    const { createClassroomChatToolkit } = await import('./tools')
    const toolkit = createClassroomChatToolkit(bridge)

    const result = await toolkit.mcp_call_tool!.execute!({
      name: 'docs.search',
      arguments: { q: 'let' },
    }, toolOptions())

    expect(result).toEqual({ ok: true, result: { hits: 1 } })
    expect(callMcpToolMock).toHaveBeenCalledWith('docs.search', { q: 'let' })
  })

  it('mcp_call_tool rejects undiscovered tool names', async () => {
    listMcpToolsMock.mockResolvedValueOnce([
      { name: 'docs.search', description: 'Search docs', inputSchema: { type: 'object' } },
    ])
    const { createClassroomChatToolkit } = await import('./tools')
    const toolkit = createClassroomChatToolkit(bridge)

    const result = await toolkit.mcp_call_tool!.execute!({
      name: 'shell.delete_everything',
      arguments: {},
    }, toolOptions())

    expect(result).toEqual({
      ok: false,
      error: 'MCP tool "shell.delete_everything" is not available from discovery',
    })
    expect(callMcpToolMock).not.toHaveBeenCalled()
  })

  it('loads MCP tools with safe collision-free names', async () => {
    listMcpToolsMock.mockResolvedValueOnce([
      { name: 'a:b', inputSchema: { type: 'object' } },
      { name: 'a/b', inputSchema: { type: 'object' } },
      { name: 'a.b', inputSchema: { type: 'object' } },
    ])
    const { loadMcpToolkit } = await import('./tools')

    const toolkit = await loadMcpToolkit()
    const keys = Object.keys(toolkit)

    expect(keys).toHaveLength(3)
    expect(new Set(keys).size).toBe(3)
  })
})

function toolOptions() {
  return {
    toolCallId: 'tool-call',
    abortSignal: new AbortController().signal,
    human: async () => undefined,
  }
}
