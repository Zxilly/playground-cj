import type { CourseContentPack } from './content-packs'
import type { ClassroomSnapshot, LearningEvidence } from './state'

export type ConceptProgress
  = | 'unseen'
    | 'seen'
    | 'practicing'
    | 'demonstrated'
    | 'blocked'
    | 'stale'

function successfulEvidence(
  evidence: LearningEvidence[],
  skillId: string,
  acceptedTypes: ReadonlySet<LearningEvidence['type']>,
): boolean {
  return evidence.some(item =>
    item.learningSkillId === skillId
    && item.outcome === 'success'
    && acceptedTypes.has(item.type))
}

/**
 * Derive learner-facing Concept Progress from exposure and Learning Evidence.
 * No model-facing command can assign this value.
 */
export function deriveConceptProgress(
  snapshot: ClassroomSnapshot,
  pack: CourseContentPack,
): ConceptProgress {
  const conceptId = pack.concept.id
  const attemptRevisions = new Map(
    snapshot.attempts.map(attempt => [attempt.id, attempt.recordedRevision]),
  )
  const evidenceOrdinals = new Map(
    snapshot.evidence.map((item, index) => [item.id, index]),
  )
  const evidence = snapshot.evidence.filter(item => item.conceptId === conceptId)
  const currentEvidence = evidence.filter(item =>
    item.learningContractVersion === pack.learningContractVersion)
  const keySkills = pack.learningSkills.filter(skill => skill.key)
  const skillIds = keySkills.length > 0 ? keySkills.map(skill => skill.id) : pack.learningSkills.map(skill => skill.id)

  const hasStaleSuccess = evidence.some(item =>
    item.learningContractVersion !== pack.learningContractVersion
    && item.outcome === 'success')

  const blocked = skillIds.some((skillId) => {
    const skillEvidence = currentEvidence
      .filter(item => item.learningSkillId === skillId)
      .sort((left, right) => {
        const leftRevision = left.attemptId
          ? attemptRevisions.get(left.attemptId)
          : undefined
        const rightRevision = right.attemptId
          ? attemptRevisions.get(right.attemptId)
          : undefined
        if (
          leftRevision !== undefined
          && rightRevision !== undefined
          && leftRevision !== rightRevision
        ) {
          return leftRevision - rightRevision
        }
        return (evidenceOrdinals.get(left.id) ?? Number.MAX_SAFE_INTEGER)
          - (evidenceOrdinals.get(right.id) ?? Number.MAX_SAFE_INTEGER)
      })
    let consecutiveFailures = 0
    for (const item of skillEvidence) {
      if (item.outcome === 'success')
        consecutiveFailures = 0
      else
        consecutiveFailures += 1
    }
    return consecutiveFailures >= 3
  })
  if (blocked)
    return 'blocked'

  const demonstratedTypes = new Set<LearningEvidence['type']>(['independent'])
  if (skillIds.length > 0 && skillIds.every(skillId =>
    successfulEvidence(currentEvidence, skillId, demonstratedTypes))) {
    return 'demonstrated'
  }

  if (hasStaleSuccess)
    return 'stale'

  if (currentEvidence.length > 0)
    return 'practicing'

  const seen = snapshot.stream.some(entry =>
    entry.conceptId === conceptId && entry.type === 'content_reference_group')
  return seen ? 'seen' : 'unseen'
}
