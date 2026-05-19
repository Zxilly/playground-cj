import { describe, expect, it } from 'vitest'
import { migrateClassroomRecord } from './migrations'
import { classroomRecordSchema } from './schema'
import { classroomStorageKey } from './store'

describe('classroom record migrations', () => {
  it('fills missing quiz ids in legacy v2 records', () => {
    const record = {
      key: classroomStorageKey('zh'),
      version: 1,
      lang: 'zh',
      updatedAt: 1234,
      session: {
        version: 2,
        lang: 'zh',
        phase: 'practice',
        stream: [{
          id: 'quiz:1001:0',
          type: 'quiz',
          quiz: {
            conceptId: 'cj.bindings.let',
            prompt: 'Print 3.',
            starterCode: '',
            expectedOutput: '3',
            matchMode: 'exact',
            status: 'active',
            createdAt: 1001,
          },
          createdAt: 1001,
        }],
        learner: { concepts: {}, evidence: [], learningNotes: '' },
        currentQuiz: {
          conceptId: 'cj.bindings.let',
          prompt: 'Print 3.',
          starterCode: '',
          expectedOutput: '3',
          matchMode: 'exact',
          status: 'active',
          createdAt: 1001,
        },
        lastRun: null,
        sessionSummary: '',
        eventQueue: [],
      },
    }

    const migrated = migrateClassroomRecord(record)
    const parsed = classroomRecordSchema.safeParse(migrated)

    expect(parsed.success).toBe(true)
    if (!parsed.success)
      return
    expect(parsed.data.session.stream[0]).toMatchObject({
      type: 'quiz',
      quiz: { id: 'quiz:1001:0' },
    })
    expect(parsed.data.session.currentQuiz).toMatchObject({ id: 'quiz:1001:0' })
  })

  it('normalises legacy unknown chat intents to change_topic', () => {
    const record = {
      key: classroomStorageKey('zh'),
      version: 1,
      lang: 'zh',
      updatedAt: 1234,
      session: {
        version: 2,
        lang: 'zh',
        phase: 'orient',
        stream: [{
          id: 'event:1:0',
          type: 'system_event',
          event: {
            type: 'chat_intent',
            intent: 'custom_old_intent',
            summary: 'old',
            createdAt: 1,
          },
          createdAt: 1,
        }],
        learner: { concepts: {}, evidence: [], learningNotes: '' },
        currentQuiz: null,
        lastRun: null,
        sessionSummary: '',
        eventQueue: [{
          type: 'chat_intent',
          intent: 'custom_old_intent',
          summary: 'old',
          createdAt: 1,
        }],
      },
    }

    const parsed = classroomRecordSchema.safeParse(migrateClassroomRecord(record))

    expect(parsed.success).toBe(true)
    if (!parsed.success)
      return
    expect(parsed.data.session.eventQueue[0]).toMatchObject({
      type: 'chat_intent',
      intent: 'change_topic',
    })
    expect(parsed.data.session.stream[0]).toMatchObject({
      type: 'system_event',
      event: { type: 'chat_intent', intent: 'change_topic' },
    })
  })
})
