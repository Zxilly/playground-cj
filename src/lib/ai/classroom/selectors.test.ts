import { describe, expect, it } from 'vitest'
import { classroomReducer, createInitialClassroomSession } from './reducer'
import {
  deriveActiveConceptId,
  deriveChapterIndex,
  deriveClassroomPendingState,
  deriveConceptProgress,
  deriveConceptProgressEntries,
  deriveLatestHeading,
  deriveLessonOutline,
  deriveSessionPendingWork,
} from './selectors'
import { blockerExplanationForEvidence, statusForConcept } from './concept-progress'
import type { ClassroomAction } from './reducer'
import type { ClassroomSession, LearningEvidence } from './types'
import { getDefaultCourseContentIndex } from '@/lib/ai/course-content/loader'

const exerciseAction: ClassroomAction = {
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
  now: 1002,
}

function baseSession(): ClassroomSession {
  return createInitialClassroomSession({ lang: 'zh' })
}

function evidence(input: Partial<LearningEvidence> & Pick<LearningEvidence, 'outcome' | 'strength' | 'createdAt'>): LearningEvidence {
  return {
    evidenceId: `evidence:${input.createdAt}`,
    skillId: 'cj.io.println.print-value',
    conceptIds: ['cj.io.println'],
    summary: 'test evidence',
    ...input,
  }
}

function withConceptStatus<T>(conceptId: string, status: 'validated' | 'read_only' | 'invalid', callback: () => T): T {
  const statuses = getDefaultCourseContentIndex().validation.conceptStatuses
  const previous = statuses[conceptId]
  statuses[conceptId] = status
  try {
    return callback()
  }
  finally {
    statuses[conceptId] = previous
  }
}

describe('deriveSessionPendingWork', () => {
  it('distinguishes idle, active exercise, and queued orchestration events', () => {
    let session = baseSession()
    expect(deriveSessionPendingWork(session)).toBe('none')

    session = classroomReducer(session, exerciseAction)
    expect(deriveSessionPendingWork(session)).toBe('awaiting_user')

    session = classroomReducer(session, {
      type: 'EMIT_CHAT_INTENT',
      intent: 'go_deeper',
      summary: 'Learner asked for detail.',
      now: 1003,
    })
    expect(deriveSessionPendingWork(session)).toBe('lesson_generation')
  })
})

describe('deriveClassroomPendingState', () => {
  it('prioritizes runner, generation, and session work in order', () => {
    expect(deriveClassroomPendingState(baseSession(), { generationRunning: true, runnerRunning: true })).toBe('runner')
    expect(deriveClassroomPendingState(baseSession(), { generationRunning: true, runnerRunning: false })).toBe('lesson_generation')

    const practicing = classroomReducer(baseSession(), exerciseAction)
    expect(deriveClassroomPendingState(practicing, { generationRunning: false, runnerRunning: false })).toBe('awaiting_user')
    expect(deriveClassroomPendingState(baseSession(), { generationRunning: false, runnerRunning: false })).toBe('idle')
  })
})

describe('deriveConceptProgress', () => {
  it('derives concept status from exposure and evidence', () => {
    let session = baseSession()
    session = classroomReducer(session, {
      type: 'APPEND_CONTENT_REFERENCE_GROUP',
      conceptId: 'cj.io.println',
      blockIds: ['cj.io.println.heading'],
      now: 1001,
    })
    session = classroomReducer(session, exerciseAction)
    session = classroomReducer(session, {
      type: 'EXERCISE_SUBMIT_FINISHED',
      result: { ok: true, stdout: 'Cangjie\n', stderr: '', exitCode: 0 },
      now: 1003,
    })

    const entries = deriveConceptProgressEntries(session)
    expect(entries.find(e => e.conceptId === 'cj.io.println')).toMatchObject({
      status: 'demonstrated',
      exposure: 'seen',
      readiness: 'ready_for_next',
    })
    expect(deriveConceptProgress(session).demonstrated).toContain('cj.io.println')
  })

  it('orders progress entries and status groups by the active learning track', () => {
    let session = baseSession()
    session = classroomReducer(session, {
      type: 'APPEND_CONTENT_REFERENCE_GROUP',
      conceptId: 'cj.io.println',
      blockIds: ['cj.io.println.heading'],
      skillId: 'cj.io.println.print-value',
      now: 1001,
    })
    session = classroomReducer(session, {
      type: 'APPEND_CONTENT_REFERENCE_GROUP',
      conceptId: 'cj.program.main',
      blockIds: ['cj.program.main.heading'],
      skillId: 'cj.program.main.write-entry',
      now: 1002,
    })

    expect(deriveConceptProgressEntries(session)
      .filter(entry => entry.status === 'seen')
      .map(entry => entry.conceptId))
      .toEqual(['cj.program.main', 'cj.io.println'])
    expect(deriveConceptProgress(session).seen).toEqual(['cj.program.main', 'cj.io.println'])
  })

  it('marks repeated failures as blocked', () => {
    let session = baseSession()
    session = classroomReducer(session, exerciseAction)
    session = classroomReducer(session, {
      type: 'EXERCISE_SUBMIT_FINISHED',
      result: { ok: true, stdout: 'wrong\n', stderr: '', exitCode: 0 },
      now: 1003,
    })
    session = classroomReducer(session, {
      type: 'EXERCISE_SUBMIT_FINISHED',
      result: { ok: true, stdout: 'still wrong\n', stderr: '', exitCode: 0 },
      now: 1004,
    })

    const blocked = deriveConceptProgressEntries(session).find(entry => entry.conceptId === 'cj.io.println')
    expect(blocked).toMatchObject({
      status: 'blocked',
      readiness: 'needs_remediation',
      blockerExplanation: '这项练习已连续 2 次未通过，建议先看相关提示再试一次。',
    })
    expect(deriveConceptProgress(session).blocked).toContain('cj.io.println')
  })

  it('keeps read-only concepts review-only instead of asking for practice evidence', () => {
    withConceptStatus('cj.io.println', 'read_only', () => {
      let session = baseSession()
      session = classroomReducer(session, {
        type: 'APPEND_CONTENT_REFERENCE_GROUP',
        conceptId: 'cj.io.println',
        blockIds: ['cj.io.println.heading'],
        now: 1001,
      })

      const entry = deriveConceptProgressEntries(session).find(item => item.conceptId === 'cj.io.println')

      expect(entry).toMatchObject({
        contentStatus: 'read_only',
        status: 'seen',
        readiness: 'review_only',
      })
    })
  })

  it('marks invalid concepts as unavailable instead of asking for exposure or practice', () => {
    withConceptStatus('cj.io.println', 'invalid', () => {
      let session = baseSession()
      session = classroomReducer(session, {
        type: 'APPEND_CONTENT_REFERENCE_GROUP',
        conceptId: 'cj.io.println',
        blockIds: ['cj.io.println.heading'],
        now: 1001,
      })

      const entry = deriveConceptProgressEntries(session).find(item => item.conceptId === 'cj.io.println')

      expect(entry).toMatchObject({
        contentStatus: 'invalid',
        status: 'seen',
        readiness: 'content_unavailable',
      })
    })
  })

  it('lets later successful evidence recover a previously blocked concept', () => {
    let session = baseSession()
    session = classroomReducer(session, exerciseAction)
    session = classroomReducer(session, {
      type: 'EXERCISE_SUBMIT_FINISHED',
      result: { ok: true, stdout: 'wrong\n', stderr: '', exitCode: 0 },
      now: 1003,
    })
    session = classroomReducer(session, {
      type: 'EXERCISE_SUBMIT_FINISHED',
      result: { ok: true, stdout: 'still wrong\n', stderr: '', exitCode: 0 },
      now: 1004,
    })
    session = classroomReducer(session, {
      type: 'EXERCISE_SUBMIT_FINISHED',
      result: { ok: true, stdout: 'Cangjie\n', stderr: '', exitCode: 0 },
      now: 1005,
    })

    const recovered = deriveConceptProgressEntries(session).find(entry => entry.conceptId === 'cj.io.println')
    expect(recovered).toMatchObject({
      status: 'demonstrated',
      readiness: 'ready_for_next',
      blockerExplanation: null,
    })
    expect(deriveConceptProgress(session).demonstrated).toContain('cj.io.println')
    expect(deriveConceptProgress(session).blocked).not.toContain('cj.io.println')
  })

  it('marks a demonstrated concept blocked again after later repeated failures', () => {
    let session = baseSession()
    session = classroomReducer(session, exerciseAction)
    session = classroomReducer(session, {
      type: 'EXERCISE_SUBMIT_FINISHED',
      result: { ok: true, stdout: 'Cangjie\n', stderr: '', exitCode: 0 },
      now: 1003,
    })
    session = classroomReducer(session, {
      ...exerciseAction,
      now: 1004,
    })
    session = classroomReducer(session, {
      type: 'EXERCISE_SUBMIT_FINISHED',
      result: { ok: true, stdout: 'wrong\n', stderr: '', exitCode: 0 },
      now: 1005,
    })
    session = classroomReducer(session, {
      type: 'EXERCISE_SUBMIT_FINISHED',
      result: { ok: true, stdout: 'still wrong\n', stderr: '', exitCode: 0 },
      now: 1006,
    })

    expect(deriveConceptProgressEntries(session).find(entry => entry.conceptId === 'cj.io.println')).toMatchObject({
      status: 'blocked',
      readiness: 'needs_remediation',
    })
    expect(deriveConceptProgress(session).blocked).toContain('cj.io.println')
  })

  it('keeps mastery evidence stronger than later non-mastery success evidence', () => {
    expect(statusForConcept([
      evidence({ outcome: 'success', strength: 'mastery', createdAt: 1001 }),
      evidence({ outcome: 'success', strength: 'aided', createdAt: 1002 }),
    ], 'seen')).toBe('mastered')
  })

  it('treats repeated failures after stale evidence as blocked', () => {
    expect(statusForConcept([
      evidence({ outcome: 'success', strength: 'mastery', createdAt: 1001 }),
      evidence({ outcome: 'self_report', strength: 'stale', createdAt: 1002 }),
      evidence({ outcome: 'failure', strength: 'independent', createdAt: 1003 }),
      evidence({ outcome: 'failure', strength: 'independent', createdAt: 1004 }),
    ], 'seen')).toBe('blocked')
  })

  it('lets newer stale evidence supersede older unresolved failures', () => {
    expect(statusForConcept([
      evidence({ outcome: 'success', strength: 'mastery', createdAt: 1001 }),
      evidence({ outcome: 'failure', strength: 'independent', createdAt: 1002 }),
      evidence({ outcome: 'failure', strength: 'independent', createdAt: 1003 }),
      evidence({ outcome: 'self_report', strength: 'stale', createdAt: 1004 }),
    ], 'seen')).toBe('stale')
  })

  it('counts only failures after the latest stale evidence in blocker explanations', () => {
    const history = [
      evidence({ outcome: 'success', strength: 'mastery', createdAt: 1001 }),
      evidence({ outcome: 'failure', strength: 'independent', createdAt: 1002 }),
      evidence({ outcome: 'failure', strength: 'independent', createdAt: 1003 }),
      evidence({ outcome: 'self_report', strength: 'stale', createdAt: 1004 }),
      evidence({ outcome: 'failure', strength: 'independent', createdAt: 1005 }),
      evidence({ outcome: 'failure', strength: 'independent', createdAt: 1006 }),
    ]

    expect(statusForConcept(history, 'seen')).toBe('blocked')
    expect(blockerExplanationForEvidence(history, 'zh')).toBe('这项练习已连续 2 次未通过，建议先看相关提示再试一次。')
  })
})

describe('lesson outline selectors', () => {
  it('derives the active concept for cross-mode links and default chat scope', () => {
    let session = baseSession()
    session = classroomReducer(session, {
      type: 'APPEND_CONTENT_REFERENCE_GROUP',
      conceptId: 'cj.program.main',
      blockIds: ['cj.program.main.heading'],
      now: 1001,
    })
    expect(deriveActiveConceptId(session)).toBe('cj.program.main')

    session = classroomReducer(session, exerciseAction)
    expect(deriveActiveConceptId(session)).toBe('cj.io.println')
  })

  it('prefers the active exercise concept over a stale track target', () => {
    const session = classroomReducer(baseSession(), exerciseAction)
    const staleTargetSession: ClassroomSession = {
      ...session,
      track: {
        ...session.track,
        targetConceptId: 'cj.program.main',
      },
    }

    expect(deriveActiveConceptId(staleTargetSession)).toBe('cj.io.println')
  })

  it('builds chapters from content references, not copied lesson blocks', () => {
    let session = baseSession()
    session = classroomReducer(session, {
      type: 'APPEND_CONTENT_REFERENCE_GROUP',
      conceptId: 'cj.program.main',
      blockIds: ['cj.program.main.heading', 'cj.program.main.shape'],
      now: 1001,
    })

    expect(deriveLatestHeading(session)).toBe('程序入口与 main')
    expect(deriveChapterIndex(session)).toEqual([
      expect.objectContaining({
        text: '程序入口与 main',
        level: 2,
        streamItemId: 'content-group:1001:0',
      }),
    ])
  })

  it('returns bounded recent items and active exercise metadata', () => {
    let session = baseSession()
    session = classroomReducer(session, {
      type: 'APPEND_CONTENT_REFERENCE_GROUP',
      conceptId: 'cj.io.println',
      blockIds: ['cj.io.println.heading'],
      now: 1001,
    })
    session = classroomReducer(session, exerciseAction)

    const outline = deriveLessonOutline(session, 1)

    expect(outline.chapters.map(c => c.text)).toEqual(['标准输出 println'])
    expect(outline.recentItems).toEqual([
      expect.objectContaining({
        type: 'exercise_instance',
        summary: 'Exercise active for cj.io.println.print-value',
      }),
    ])
    expect(outline.activeExercise).toMatchObject({
      skillId: 'cj.io.println.print-value',
      status: 'active',
    })
  })

  it('reuses the chapter index cache while the stream reference is stable', () => {
    const session = classroomReducer(baseSession(), {
      type: 'APPEND_CONTENT_REFERENCE_GROUP',
      conceptId: 'cj.io.println',
      blockIds: ['cj.io.println.heading'],
      now: 1001,
    })

    const first = deriveChapterIndex(session)
    const second = deriveChapterIndex({ ...session, phase: 'teach' })

    expect(second).toBe(first)
  })
})
