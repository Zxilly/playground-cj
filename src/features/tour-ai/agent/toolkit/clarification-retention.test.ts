import { describe, expect, it } from 'vitest'
import { resolveClarificationRetentionTarget } from './clarification-retention'

describe('clarification retention target resolution', () => {
  const conceptStatuses = {
    'cj.io.println': 'validated',
    'cj.static.only': 'read_only',
    'cj.invalid': 'invalid',
  } as const

  it('retains validated concepts as clarifications without changing concept progress', () => {
    expect(resolveClarificationRetentionTarget({
      conceptId: 'cj.io.println',
      conceptStatuses,
    })).toEqual({
      ok: true,
      conceptId: 'cj.io.println',
      conceptStatus: 'validated',
      artifactKind: 'clarification',
      progressEffect: 'does_not_update_concept_progress',
    })
  })

  it('retains read-only concepts as read-only clarifications', () => {
    expect(resolveClarificationRetentionTarget({
      conceptId: 'cj.static.only',
      conceptStatuses,
    })).toEqual({
      ok: true,
      conceptId: 'cj.static.only',
      conceptStatus: 'read_only',
      artifactKind: 'read_only_clarification',
      progressEffect: 'does_not_update_concept_progress',
    })
  })

  it('falls back from active concept to exercise concept and then track target', () => {
    expect(resolveClarificationRetentionTarget({
      activeConceptId: 'cj.io.println',
      currentExerciseConceptIds: ['cj.static.only'],
      trackTargetConceptId: 'cj.invalid',
      conceptStatuses,
    })).toMatchObject({
      ok: true,
      conceptId: 'cj.io.println',
    })

    expect(resolveClarificationRetentionTarget({
      currentExerciseConceptIds: ['cj.static.only'],
      trackTargetConceptId: 'cj.io.println',
      conceptStatuses,
    })).toMatchObject({
      ok: true,
      conceptId: 'cj.static.only',
    })

    expect(resolveClarificationRetentionTarget({
      trackTargetConceptId: 'cj.io.println',
      conceptStatuses,
    })).toMatchObject({
      ok: true,
      conceptId: 'cj.io.println',
    })
  })

  it('rejects unavailable or invalid concepts instead of creating retained review material', () => {
    expect(resolveClarificationRetentionTarget({
      conceptId: 'cj.out-of-pack.topic',
      conceptStatuses,
    })).toEqual({
      ok: false,
      error: 'Concept "cj.out-of-pack.topic" is not available for retained Review Artifacts.',
    })

    expect(resolveClarificationRetentionTarget({
      conceptId: 'cj.invalid',
      conceptStatuses,
    })).toEqual({
      ok: false,
      error: 'Concept "cj.invalid" is not available for retained Review Artifacts.',
    })
  })

  it('rejects retention when no classroom concept context exists', () => {
    expect(resolveClarificationRetentionTarget({
      conceptStatuses,
    })).toEqual({
      ok: false,
      error: 'No active concept to retain this clarification under.',
    })
  })
})
