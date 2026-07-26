import type { ClassroomSnapshot } from './state'
import { MAX_PERSONALIZATION_FAILURE_EVIDENCE_IDS } from './state'

export interface FailureEvidenceScope {
  conceptId: string
  learningSkillId: string
  learningContractVersion: string
}

/**
 * Derive the bounded unresolved-failure suffix for one Learning Contract.
 *
 * A successful observable Attempt resolves every earlier failure in the same
 * Concept/Learning Skill/Contract scope. Only failures recorded after the most
 * recent success remain applicable, and only the most recent bounded suffix is
 * exposed to or accepted from the teacher model.
 *
 * `beforeRevision` makes the same derivation usable for historical integrity:
 * an Exercise Instance is checked against the aggregate state that existed
 * immediately before that instance was recorded, so a later success does not
 * rewrite an already-created instance.
 */
export function deriveUnresolvedFailureEvidenceIds(
  snapshot: ClassroomSnapshot,
  scope: FailureEvidenceScope,
  beforeRevision = Number.POSITIVE_INFINITY,
): string[] {
  const attempts = new Map(
    snapshot.attempts.map(attempt => [attempt.id, attempt]),
  )
  const observations = snapshot.evidence
    .flatMap((evidence) => {
      if (
        evidence.conceptId !== scope.conceptId
        || evidence.learningSkillId !== scope.learningSkillId
        || evidence.learningContractVersion !== scope.learningContractVersion
        || evidence.attemptId === undefined
      ) {
        return []
      }
      const attempt = attempts.get(evidence.attemptId)
      if (!attempt || attempt.recordedRevision >= beforeRevision)
        return []
      return [{ evidence, recordedRevision: attempt.recordedRevision }]
    })
    .sort((left, right) =>
      left.recordedRevision - right.recordedRevision
      || left.evidence.id.localeCompare(right.evidence.id))

  const unresolved: string[] = []
  for (const observation of observations) {
    if (observation.evidence.outcome === 'success')
      unresolved.length = 0
    else
      unresolved.push(observation.evidence.id)
  }
  return unresolved.slice(-MAX_PERSONALIZATION_FAILURE_EVIDENCE_IDS)
}
