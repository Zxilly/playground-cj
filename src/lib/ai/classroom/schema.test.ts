import { describe, expect, it } from 'vitest'
import {
  classroomEventSchema,
  classroomRecordSchema,
  classroomSessionSchema,
  classroomStreamItemSchema,
  learningEvidenceSchema,
  lessonContentBlockSchema,
  lessonContentBlocksSchema,
  markdownBodySchema,
  richTextSchema,
} from './schema'
import { createInitialClassroomSession } from './reducer'
import { classroomStorageKey } from './store'

describe('lesson content DSL schema', () => {
  it('accepts reusable core content blocks without exercise authoring', () => {
    const result = lessonContentBlocksSchema.safeParse([
      { type: 'heading', text: 'Bindings', level: 2 },
      { type: 'paragraph', body: 'Use `let` for immutable bindings.' },
      {
        type: 'code_example',
        title: 'Print a value',
        code: 'main() {\n    println(3)\n}',
        highlights: [{ startLine: 2, label: 'output' }],
      },
    ])

    expect(result.success).toBe(true)
  })

  it('rejects generated quiz blocks from core content', () => {
    expect(lessonContentBlockSchema.safeParse({
      type: 'quiz',
      conceptId: 'cj.io.println',
      prompt: 'Print 3.',
      starterCode: '',
      expectedOutput: '3',
    }).success).toBe(false)
  })

  it('accepts rich text strings and discriminated spans', () => {
    expect(richTextSchema.safeParse('just a string')).toMatchObject({
      success: true,
      data: [{ type: 'text', text: 'just a string' }],
    })
    expect(richTextSchema.safeParse([
      { type: 'text', text: 'Use ' },
      { type: 'code', code: 'let', lang: 'cangjie' },
    ]).success).toBe(true)
  })

  it('rejects legacy untagged rich text and non-string markdown bodies', () => {
    expect(richTextSchema.safeParse([{ text: 'Use ' }]).success).toBe(false)
    expect(markdownBodySchema.safeParse([{ type: 'text', text: 'x' }]).success).toBe(false)
  })
})

describe('classroom schemas', () => {
  const exercise = {
    id: 'exercise:1:0',
    templateId: 'cj.io.println.print-value.cangjie',
    templateVersion: '2026-05-28',
    skillId: 'cj.io.println.print-value',
    conceptIds: ['cj.io.println'],
    prompt: 'Print Cangjie.',
    starterCode: '',
    expectedOutput: 'Cangjie',
    matchMode: 'exact',
    status: 'active',
    intent: 'mainline',
    personalizationInputs: { summary: 'test', difficulty: 1 },
    createdAt: 1,
  }

  it('accepts v3 exercise and content-reference events', () => {
    expect(classroomEventSchema.safeParse({
      type: 'exercise_success',
      exerciseInstanceId: exercise.id,
      exerciseIntent: 'mainline',
      skillId: exercise.skillId,
      conceptIds: exercise.conceptIds,
      summary: 'done',
      createdAt: 2,
    }).success).toBe(true)

    expect(classroomStreamItemSchema.safeParse({
      id: 'content-group:1:0',
      type: 'content_reference_group',
      groupId: 'group:1:0',
      conceptId: 'cj.io.println',
      references: [{
        packId: 'default-entry',
        contentVersion: '2026-05-28',
        blockId: 'cj.io.println.heading',
        conceptId: 'cj.io.println',
      }],
      createdAt: 1,
    }).success).toBe(true)

    expect(classroomStreamItemSchema.safeParse({
      id: exercise.id,
      type: 'exercise_instance',
      exercise,
      createdAt: 1,
    }).success).toBe(true)

    expect(classroomStreamItemSchema.safeParse({
      id: 'run:2:1',
      type: 'run_result',
      exerciseInstanceId: exercise.id,
      result: {
        ok: true,
        stdout: 'Cangjie\n',
        stderr: '',
        exitCode: 0,
        attemptMode: 'submit',
      },
      matched: true,
      createdAt: 2,
    }).success).toBe(true)

    expect(classroomStreamItemSchema.safeParse({
      id: 'run:3:2',
      type: 'run_result',
      exerciseInstanceId: exercise.id,
      result: {
        ok: false,
        stdout: '',
        stderr: 'Remote action failed: runner unavailable',
        exitCode: null,
        attemptMode: 'submit',
        failureKind: 'runner_unavailable',
      },
      matched: false,
      createdAt: 3,
    }).success).toBe(true)
  })

  it('accepts review check chat intents and exercise instances', () => {
    expect(classroomEventSchema.safeParse({
      type: 'chat_intent',
      intent: 'review_check',
      summary: 'Review cj.io.println.',
      activeConceptId: 'cj.io.println',
      createdAt: 2,
    }).success).toBe(true)

    expect(classroomEventSchema.safeParse({
      type: 'exercise_success',
      exerciseInstanceId: exercise.id,
      exerciseIntent: 'review_check',
      skillId: exercise.skillId,
      conceptIds: exercise.conceptIds,
      summary: 'Review check passed.',
      createdAt: 2,
    }).success).toBe(true)

    expect(classroomStreamItemSchema.safeParse({
      id: exercise.id,
      type: 'exercise_instance',
      exercise: { ...exercise, intent: 'review_check' },
      createdAt: 1,
    }).success).toBe(true)

    expect(learningEvidenceSchema.safeParse({
      evidenceId: 'evidence:1:0',
      skillId: exercise.skillId,
      conceptIds: exercise.conceptIds,
      exerciseInstanceId: exercise.id,
      exerciseIntent: 'review_check',
      outcome: 'success',
      strength: 'independent',
      summary: 'Review check passed.',
      createdAt: 2,
    }).success).toBe(true)

    expect(classroomStreamItemSchema.safeParse({
      id: 'evidence-marker:2:1',
      type: 'learning_evidence_marker',
      evidenceId: 'evidence:1:0',
      conceptId: 'cj.io.println',
      skillId: exercise.skillId,
      exerciseIntent: 'review_check',
      outcome: 'success',
      strength: 'independent',
      summary: 'Review check passed.',
      createdAt: 2,
    }).success).toBe(true)
  })

  it('rejects legacy v2 sessions and stream items', () => {
    expect(classroomStreamItemSchema.safeParse({
      id: 'lesson:1:0',
      type: 'lesson_blocks',
      blocks: [{ type: 'heading', text: 'Legacy', level: 2 }],
      createdAt: 1,
    }).success).toBe(false)

    expect(classroomSessionSchema.safeParse({
      version: 2,
      lang: 'zh',
      phase: 'orient',
      stream: [],
      learner: { concepts: {}, evidence: [], learningNotes: '' },
      currentQuiz: null,
      lastRun: null,
      sessionSummary: 'legacy',
      eventQueue: [],
    }).success).toBe(false)
  })

  it('accepts a fresh v3 session and record envelope', () => {
    const session = createInitialClassroomSession({ lang: 'zh' })

    expect(classroomSessionSchema.safeParse(session).success).toBe(true)
    expect(classroomRecordSchema.safeParse({
      key: classroomStorageKey('zh'),
      version: 1,
      lang: 'zh',
      updatedAt: 1234,
      session,
    }).success).toBe(true)
  })
})
