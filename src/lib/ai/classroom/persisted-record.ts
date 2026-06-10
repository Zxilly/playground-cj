import type { z } from 'zod'
import { migrateClassroomRecord } from './migrations'
import { classroomRecordSchema } from './schema'
import { classroomStorageKey } from './store'
import type { ClassroomSession } from './types'

const CURRENT_CLASSROOM_SESSION_VERSION = 3
type TerminalExerciseStatus = 'success' | 'skip'

export type PersistedClassroomRecord = z.infer<typeof classroomRecordSchema>

export type PersistedClassroomRecordDiscard
  = | { reason: 'missing_record' }
    | { reason: 'unsupported_session_version', version: number }
    | { reason: 'schema_validation_failed', issues: string[] }
    | { reason: 'lang_mismatch', expected: string, actual: string }
    | { reason: 'key_mismatch', expected: string, actual: string }

export type DecodePersistedClassroomRecordResult
  = | { ok: true, record: PersistedClassroomRecord, session: ClassroomSession }
    | { ok: false, discard: PersistedClassroomRecordDiscard }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function unsupportedSessionVersion(raw: unknown): number | null {
  if (!isRecord(raw) || !isRecord(raw.session))
    return null

  const version = raw.session.version
  if (typeof version !== 'number' || version === CURRENT_CLASSROOM_SESSION_VERSION)
    return null
  return version
}

function schemaIssueSummaries(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join('.')
    return path.length > 0 ? `${path}: ${issue.message}` : issue.message
  })
}

function terminalStatusForExercise(session: ClassroomSession, exerciseId: string): TerminalExerciseStatus | null {
  for (let index = session.eventQueue.length - 1; index >= 0; index -= 1) {
    const event = session.eventQueue[index]
    if (event.type !== 'exercise_success' && event.type !== 'exercise_skip')
      continue
    if (event.exerciseInstanceId !== exerciseId)
      continue
    if (event.type === 'exercise_success')
      return 'success'
    if (event.type === 'exercise_skip')
      return 'skip'
  }

  for (let index = session.learner.evidence.length - 1; index >= 0; index -= 1) {
    const evidence = session.learner.evidence[index]
    if (evidence.exerciseInstanceId !== exerciseId)
      continue
    if (evidence.outcome === 'success' || evidence.outcome === 'skip')
      return evidence.outcome
  }

  return null
}

function normalizeTerminalExerciseStatus(session: ClassroomSession): ClassroomSession {
  const currentExercise = session.currentExercise
  if (!currentExercise)
    return session

  const terminalStatus = terminalStatusForExercise(session, currentExercise.id)
  if (!terminalStatus)
    return session

  let changed = currentExercise.status !== terminalStatus
  const stream = session.stream.map((item) => {
    if (item.type !== 'exercise_instance' || item.exercise.id !== currentExercise.id)
      return item
    if (item.exercise.status === terminalStatus)
      return item
    changed = true
    return {
      ...item,
      exercise: {
        ...item.exercise,
        status: terminalStatus,
      },
    }
  })

  if (!changed)
    return session

  return {
    ...session,
    currentExercise: {
      ...currentExercise,
      status: terminalStatus,
    },
    stream,
  }
}

export function persistedClassroomRecordKey(lang: string): string {
  return classroomStorageKey(lang)
}

export function encodePersistedClassroomRecord(
  session: ClassroomSession,
  updatedAt = Date.now(),
): PersistedClassroomRecord {
  const normalizedSession = normalizeTerminalExerciseStatus(session)
  return classroomRecordSchema.parse({
    key: persistedClassroomRecordKey(normalizedSession.lang),
    version: 1,
    lang: normalizedSession.lang,
    updatedAt,
    session: normalizedSession,
  })
}

export function decodePersistedClassroomRecord(
  raw: unknown,
  lang: string,
): DecodePersistedClassroomRecordResult {
  if (raw == null)
    return { ok: false, discard: { reason: 'missing_record' } }

  const migrated = migrateClassroomRecord(raw)
  const unsupportedVersion = unsupportedSessionVersion(migrated)
  if (unsupportedVersion != null) {
    return {
      ok: false,
      discard: { reason: 'unsupported_session_version', version: unsupportedVersion },
    }
  }

  const parsed = classroomRecordSchema.safeParse(migrated)
  if (!parsed.success) {
    return {
      ok: false,
      discard: {
        reason: 'schema_validation_failed',
        issues: schemaIssueSummaries(parsed.error),
      },
    }
  }

  if (parsed.data.lang !== lang || parsed.data.session.lang !== lang) {
    return {
      ok: false,
      discard: {
        reason: 'lang_mismatch',
        expected: lang,
        actual: parsed.data.lang !== lang ? parsed.data.lang : parsed.data.session.lang,
      },
    }
  }

  const expectedKey = persistedClassroomRecordKey(lang)
  if (parsed.data.key !== expectedKey) {
    return {
      ok: false,
      discard: { reason: 'key_mismatch', expected: expectedKey, actual: parsed.data.key },
    }
  }

  const session = normalizeTerminalExerciseStatus(parsed.data.session)
  const record = session === parsed.data.session ? parsed.data : { ...parsed.data, session }
  return { ok: true, record, session }
}

export function shouldWarnForPersistedClassroomRecordDiscard(
  discard: PersistedClassroomRecordDiscard,
): boolean {
  return discard.reason !== 'missing_record'
}

export function describePersistedClassroomRecordDiscard(
  discard: PersistedClassroomRecordDiscard,
): string {
  switch (discard.reason) {
    case 'missing_record':
      return 'No persisted record was found.'
    case 'unsupported_session_version':
      return `Unsupported classroom session version ${discard.version}.`
    case 'schema_validation_failed':
      return `Persisted record failed schema validation: ${discard.issues.join('; ')}`
    case 'lang_mismatch':
      return `Persisted record language mismatch: expected ${discard.expected}, got ${discard.actual}.`
    case 'key_mismatch':
      return `Persisted record key mismatch: expected ${discard.expected}, got ${discard.actual}.`
  }
}
