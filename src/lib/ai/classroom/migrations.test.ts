import { describe, expect, it } from 'vitest'
import {
  decodePersistedClassroomRecord,
  encodePersistedClassroomRecord,
  persistedClassroomRecordKey,
} from './persisted-record'
import { classroomReducer, createInitialClassroomSession } from './reducer'

describe('persisted classroom record codec', () => {
  it('encodes a v3 classroom record envelope', () => {
    const session = createInitialClassroomSession({ lang: 'zh' })

    expect(encodePersistedClassroomRecord(session, 1234)).toMatchObject({
      key: persistedClassroomRecordKey('zh'),
      version: 1,
      lang: 'zh',
      updatedAt: 1234,
      session,
    })
  })

  it('decodes v3 records through the persisted record interface', () => {
    const session = createInitialClassroomSession({ lang: 'zh' })
    const record = encodePersistedClassroomRecord(session, 1)

    const decoded = decodePersistedClassroomRecord(record, 'zh')

    if (!decoded.ok)
      throw new Error(`Expected record to decode, got ${decoded.discard.reason}`)
    expect(decoded.record).toEqual(record)
    expect(decoded.session).toEqual(session)
  })

  it('normalizes terminal exercise status before saving or loading', () => {
    const active = classroomReducer(createInitialClassroomSession({ lang: 'zh' }), {
      type: 'CREATE_EXERCISE_INSTANCE',
      exercise: {
        templateId: 'cj.io.println.print-value.cangjie',
        templateVersion: '2026-05-28',
        skillId: 'cj.io.println.print-value',
        conceptIds: ['cj.io.println'],
        prompt: 'Print Cangjie.',
        starterCode: '',
        expectedOutput: 'Cangjie',
        matchMode: 'exact',
        intent: 'mainline',
        personalizationInputs: { summary: 'test' },
      },
      now: 1001,
    })
    const skipped = classroomReducer(active, { type: 'EXERCISE_SKIP', now: 1002 })
    const mixed = {
      ...skipped,
      currentExercise: active.currentExercise,
      stream: active.stream,
    }

    const encoded = encodePersistedClassroomRecord(mixed, 1)
    const encodedExercise = encoded.session.stream.find(item => item.type === 'exercise_instance')
    expect(encoded.session.currentExercise?.status).toBe('skip')
    expect(encodedExercise).toMatchObject({
      type: 'exercise_instance',
      exercise: expect.objectContaining({ status: 'skip' }),
    })

    const decoded = decodePersistedClassroomRecord({
      ...encoded,
      session: mixed,
    }, 'zh')

    if (!decoded.ok)
      throw new Error(`Expected record to decode, got ${decoded.discard.reason}`)
    const decodedExercise = decoded.session.stream.find(item => item.type === 'exercise_instance')
    expect(decoded.session.currentExercise?.status).toBe('skip')
    expect(decodedExercise).toMatchObject({
      type: 'exercise_instance',
      exercise: expect.objectContaining({ status: 'skip' }),
    })
  })

  it('does not migrate legacy v2 classroom sessions', () => {
    const legacy = {
      key: persistedClassroomRecordKey('zh'),
      version: 1,
      lang: 'zh',
      updatedAt: 1,
      session: {
        version: 2,
        lang: 'zh',
        stream: [],
        currentQuiz: null,
      },
    }

    const decoded = decodePersistedClassroomRecord(legacy, 'zh')

    if (decoded.ok)
      throw new Error('Expected legacy record to be discarded')
    expect(decoded.discard).toEqual({
      reason: 'unsupported_session_version',
      version: 2,
    })
  })

  it('reports schema validation failures after migration policy is applied', () => {
    const decoded = decodePersistedClassroomRecord({
      key: persistedClassroomRecordKey('zh'),
      version: 1,
      lang: 'zh',
      updatedAt: 1,
      session: { version: 3, lang: 'zh' },
    }, 'zh')

    if (decoded.ok)
      throw new Error('Expected invalid v3 record to be discarded')
    expect(decoded.discard.reason).toBe('schema_validation_failed')
    expect(decoded.discard).toMatchObject({
      issues: expect.arrayContaining([expect.stringContaining('phase')]),
    })
  })

  it('reports language and storage key mismatches separately', () => {
    const session = createInitialClassroomSession({ lang: 'zh' })
    const record = encodePersistedClassroomRecord(session, 1)
    const wrongLang = decodePersistedClassroomRecord({ ...record, lang: 'en' }, 'zh')
    const wrongSessionLang = decodePersistedClassroomRecord({
      ...record,
      session: { ...record.session, lang: 'en' },
    }, 'zh')
    const wrongKey = decodePersistedClassroomRecord({
      ...record,
      key: persistedClassroomRecordKey('en'),
    }, 'zh')

    if (wrongLang.ok || wrongSessionLang.ok || wrongKey.ok)
      throw new Error('Expected mismatched records to be discarded')
    expect(wrongLang.discard).toEqual({
      reason: 'lang_mismatch',
      expected: 'zh',
      actual: 'en',
    })
    expect(wrongSessionLang.discard).toEqual({
      reason: 'lang_mismatch',
      expected: 'zh',
      actual: 'en',
    })
    expect(wrongKey.discard).toEqual({
      reason: 'key_mismatch',
      expected: persistedClassroomRecordKey('zh'),
      actual: persistedClassroomRecordKey('en'),
    })
  })

  it('reports missing records without treating them as corrupt', () => {
    expect(decodePersistedClassroomRecord(null, 'zh')).toEqual({
      ok: false,
      discard: { reason: 'missing_record' },
    })
  })
})
