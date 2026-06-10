import { describe, expect, it } from 'vitest'
import { classroomReducer, createInitialClassroomSession } from './reducer'
import { readClassroomConcepts, readClassroomCourseContent, readClassroomStateModel } from './read-models'
import type { ClassroomAction } from './reducer'
import type { LearningEvidence } from './types'
import { getDefaultCourseContentIndex } from '@/lib/ai/course-content/loader'
import type { ConceptValidationStatus } from '@/lib/ai/course-content/types'

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

function evidence(input: Partial<LearningEvidence> & Pick<LearningEvidence, 'outcome' | 'strength' | 'createdAt'>): LearningEvidence {
  return {
    evidenceId: `evidence:${input.createdAt}`,
    skillId: 'cj.io.println.print-value',
    conceptIds: ['cj.io.println'],
    summary: 'test evidence',
    ...input,
  }
}

function withConceptStatus<T>(conceptId: string, status: ConceptValidationStatus, callback: () => T): T {
  const statuses = getDefaultCourseContentIndex().validation.conceptStatuses
  const previous = statuses[conceptId]
  statuses[conceptId] = status
  try {
    return callback()
  }
  finally {
    if (previous == null)
      delete statuses[conceptId]
    else
      statuses[conceptId] = previous
  }
}

describe('readClassroomStateModel', () => {
  it('returns the bounded session state used by classroom read tools', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
    session = classroomReducer(session, {
      type: 'EMIT_CHAT_INTENT',
      intent: 'go_deeper',
      summary: 'Learner wants more detail.',
      now: 1001,
    })

    expect(readClassroomStateModel(session, {
      includeContentPack: true,
      includeQueuedEvents: true,
    })).toMatchObject({
      phase: 'orient',
      pendingAction: 'lesson_generation',
      contentPack: {
        packId: 'default-entry',
        contentVersion: '2026-05-28',
        activeTrackId: 'default-entry',
      },
      queuedEvents: [
        expect.objectContaining({ type: 'chat_intent' }),
      ],
      learner: {
        evidence: [],
        reviewExposures: [],
        reviewArtifactGroups: [],
      },
    })
  })

  it('includes actionable concept progress details for lesson decisions', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
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

    expect(readClassroomStateModel(session).conceptProgressDetails.find(entry => entry.conceptId === 'cj.io.println'))
      .toMatchObject({
        status: 'blocked',
        readiness: 'needs_remediation',
        blockerExplanation: '这项练习已连续 2 次未通过，建议先看相关提示再试一次。',
      })
  })

  it('orders learner review context by the active learning track', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
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
    session = classroomReducer(session, {
      type: 'SAVE_REVIEW_ARTIFACT',
      artifact: {
        artifactId: 'println-note',
        kind: 'clarification',
        conceptId: 'cj.io.println',
        title: 'println note',
        body: 'println comes later in the track.',
        summary: 'println summary',
        evidenceIds: [],
      },
      emitMarker: false,
      now: 1003,
    })
    session = classroomReducer(session, {
      type: 'SAVE_REVIEW_ARTIFACT',
      artifact: {
        artifactId: 'main-note',
        kind: 'clarification',
        conceptId: 'cj.program.main',
        title: 'main note',
        body: 'main comes first in the track.',
        summary: 'main summary',
        evidenceIds: [],
      },
      emitMarker: false,
      now: 1004,
    })

    const model = readClassroomStateModel(session)

    expect(model.learner.reviewExposures.map(exposure => `${exposure.conceptId}:${exposure.blockId}`))
      .toEqual(['cj.program.main:cj.program.main.heading', 'cj.io.println:cj.io.println.heading'])
    expect(model.learner.reviewArtifactGroups.map(group => group.conceptId))
      .toEqual(['cj.program.main', 'cj.io.println'])
  })
})

describe('readClassroomCourseContent', () => {
  it('returns localized Core Content references and templates from the classroom content pack', () => {
    const session = createInitialClassroomSession({ lang: 'en' })
    const model = readClassroomCourseContent(session, {
      conceptId: 'cj.io.println',
    })

    expect(model).toMatchObject({
      packId: 'default-entry',
      contentVersion: '2026-05-28',
      track: expect.objectContaining({ trackId: 'default-entry' }),
    })
    expect(model.concepts).toContainEqual(expect.objectContaining({ conceptId: 'cj.io.println' }))
    expect(model.blocks).toContainEqual(expect.objectContaining({
      blockId: 'cj.io.println.heading',
      content: expect.objectContaining({ type: 'heading', text: 'Standard output println' }),
    }))
    expect(model.skills).toContainEqual(expect.objectContaining({ skillId: 'cj.io.println.print-value' }))
    expect(model.exerciseTemplates).toContainEqual(expect.objectContaining({ templateId: 'cj.io.println.print-value.cangjie' }))
  })

  it('keeps read-only content readable while hiding practice templates from AI planning', () => {
    withConceptStatus('cj.io.println', 'read_only', () => {
      const session = createInitialClassroomSession({ lang: 'zh' })
      const conceptContent = readClassroomCourseContent(session, {
        conceptId: 'cj.io.println',
      })
      const skillContent = readClassroomCourseContent(session, {
        skillId: 'cj.io.println.print-value',
      })

      expect(conceptContent.concepts).toContainEqual(expect.objectContaining({ conceptId: 'cj.io.println' }))
      expect(conceptContent.blocks).toContainEqual(expect.objectContaining({ blockId: 'cj.io.println.heading' }))
      expect(conceptContent.skills).toContainEqual(expect.objectContaining({ skillId: 'cj.io.println.print-value' }))
      expect(conceptContent.exerciseTemplates).toEqual([])
      expect(skillContent.skills).toContainEqual(expect.objectContaining({ skillId: 'cj.io.println.print-value' }))
      expect(skillContent.exerciseTemplates).toEqual([])
    })
  })
})

describe('readClassroomConcepts', () => {
  it('projects concept metadata with derived classroom status and skip counts', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
    session = classroomReducer(session, exerciseAction)
    session = classroomReducer(session, { type: 'EXERCISE_SKIP', now: 1003 })

    expect(readClassroomConcepts(session, 'en', ['cj.io.println'])).toEqual([
      expect.objectContaining({
        conceptId: 'cj.io.println',
        title: 'Standard output println',
        status: 'practicing',
        readiness: 'needs_practice',
        blockerExplanation: null,
        skipCount: 1,
      }),
    ])
  })

  it('reports invalid concepts as unavailable to planning tools', () => {
    withConceptStatus('cj.io.println', 'invalid', () => {
      const session = createInitialClassroomSession({ lang: 'zh' })

      expect(readClassroomConcepts(session, 'en', ['cj.io.println'])).toEqual([
        expect.objectContaining({
          conceptId: 'cj.io.println',
          contentStatus: 'invalid',
          status: 'unseen',
          readiness: 'content_unavailable',
        }),
      ])
    })
  })

  it('drops skip counts once later success evidence resolves the concept', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
    session = classroomReducer(session, exerciseAction)
    session = classroomReducer(session, { type: 'EXERCISE_SKIP', now: 1003 })
    session = classroomReducer(session, { ...exerciseAction, now: 1004 })
    session = classroomReducer(session, {
      type: 'EXERCISE_SUBMIT_FINISHED',
      result: { ok: true, stdout: 'Cangjie\n', stderr: '', exitCode: 0 },
      now: 1005,
    })

    expect(readClassroomConcepts(session, 'en', ['cj.io.println'])).toEqual([
      expect.objectContaining({
        conceptId: 'cj.io.println',
        status: 'demonstrated',
        readiness: 'ready_for_next',
        blockerExplanation: null,
        skipCount: 0,
      }),
    ])
  })

  it('does not carry skip counts from before the latest stale evidence', () => {
    const baseSession = createInitialClassroomSession({ lang: 'zh' })
    const session = {
      ...baseSession,
      learner: {
        ...baseSession.learner,
        evidence: [
          evidence({ outcome: 'skip', strength: 'self_report', createdAt: 1001 }),
          evidence({ outcome: 'self_report', strength: 'stale', createdAt: 1002 }),
        ],
      },
    }

    expect(readClassroomConcepts(session, 'en', ['cj.io.println'])).toEqual([
      expect.objectContaining({
        conceptId: 'cj.io.println',
        status: 'stale',
        readiness: 'needs_review_check',
        blockerExplanation: null,
        skipCount: 0,
      }),
    ])
  })

  it('includes remediation readiness and blocker explanation for blocked concepts', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
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

    expect(readClassroomConcepts(session, 'en', ['cj.io.println'])).toEqual([
      expect.objectContaining({
        conceptId: 'cj.io.println',
        status: 'blocked',
        readiness: 'needs_remediation',
        blockerExplanation: '这项练习已连续 2 次未通过，建议先看相关提示再试一次。',
      }),
    ])
  })
})
