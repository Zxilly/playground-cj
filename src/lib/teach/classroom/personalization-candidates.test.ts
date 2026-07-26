import type { LearningEvidence } from './state'
import { describe, expect, it } from 'vitest'
import { deriveUnresolvedFailureEvidenceIds } from './personalization-candidates'
import { createEmptyClassroom } from './state'

describe('unresolved failure Personalization Input candidates', () => {
  it('keeps only the bounded failure suffix after the most recent success', () => {
    const snapshot = createEmptyClassroom()
    snapshot.revision = 20

    const append = (
      id: string,
      recordedRevision: number,
      outcome: LearningEvidence['outcome'],
      learningSkillId = 'skill:target',
    ) => {
      const attemptId = `attempt:${id}`
      snapshot.attempts.push({
        id: attemptId,
        exerciseInstanceId: `exercise:${id}`,
        assistanceEventIds: [],
        teacherExposureEpochId: null,
        submission: { type: 'recall', answer: id },
        result: { passed: outcome === 'success' },
        assistance: 'none',
        createdAt: recordedRevision,
        recordedRevision,
      })
      snapshot.evidence.push({
        id: `evidence:${id}`,
        type: 'independent',
        outcome,
        conceptId: 'concept:target',
        learningSkillId,
        contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        learningContractVersion: `lc:sha256:${'b'.repeat(64)}`,
        templateId: `template:${id}`,
        templateVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        exerciseInstanceId: `exercise:${id}`,
        attemptId,
        createdAt: recordedRevision,
      })
    }

    append('old-1', 1, 'failure')
    append('old-2', 2, 'failure')
    append('resolved', 3, 'success')
    for (let index = 0; index < 10; index += 1)
      append(`current-${index}`, 4 + index, 'failure')
    append('other-skill', 14, 'failure', 'skill:other')

    const scope = {
      conceptId: 'concept:target',
      learningSkillId: 'skill:target',
      learningContractVersion: `lc:sha256:${'b'.repeat(64)}`,
    }
    expect(deriveUnresolvedFailureEvidenceIds(snapshot, scope)).toEqual(
      Array.from({ length: 8 }, (_, index) => `evidence:current-${index + 2}`),
    )
    expect(deriveUnresolvedFailureEvidenceIds(snapshot, scope, 3)).toEqual([
      'evidence:old-1',
      'evidence:old-2',
    ])
    expect(deriveUnresolvedFailureEvidenceIds(snapshot, scope, 4)).toEqual([])
  })
})
