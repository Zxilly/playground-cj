import type {
  ClassroomSnapshot,
  ExerciseInstance,
  RemovedReviewArtifact,
  ReviewArtifact,
} from './state'

type RemediationArtifact
  = | Extract<ReviewArtifact, { type: 'remediation' }>
    | Extract<RemovedReviewArtifact, { type: 'remediation' }>

export interface RemediationProvenance {
  conceptId: string
  learningSkillId: string
  learningContractVersion: string
}

export interface RemediationProvenanceIndex {
  /**
   * Resolve the one assessment contract represented by the complete failed
   * attempt lineage. Any missing, contradictory, duplicated, or mixed link
   * fails closed.
   */
  resolve: (artifact: RemediationArtifact) => RemediationProvenance | null
}

/**
 * Index the immutable Evidence -> Attempt -> Exercise Instance graph once so
 * every Remediation consumer applies the same exact-version provenance rule.
 */
export function createRemediationProvenanceIndex(
  snapshot: Pick<ClassroomSnapshot, 'attempts' | 'evidence' | 'stream'>,
): RemediationProvenanceIndex {
  const attempts = new Map(snapshot.attempts.map(attempt => [attempt.id, attempt]))
  const evidence = new Map(snapshot.evidence.map(item => [item.id, item]))
  const instances = new Map(
    snapshot.stream
      .filter((entry): entry is ExerciseInstance =>
        entry.type === 'exercise_instance')
      .map(instance => [instance.id, instance]),
  )

  return {
    resolve: (artifact) => {
      if (
        artifact.attemptIds.length === 0
        || artifact.evidenceIds.length === 0
        || new Set(artifact.attemptIds).size !== artifact.attemptIds.length
        || new Set(artifact.evidenceIds).size !== artifact.evidenceIds.length
      ) {
        return null
      }

      const artifactAttemptIds = new Set(artifact.attemptIds)
      const evidenceAttemptIds = new Set<string>()
      let learningContractVersion: string | null = null

      for (const evidenceId of artifact.evidenceIds) {
        const item = evidence.get(evidenceId)
        const attempt = item?.attemptId
          ? attempts.get(item.attemptId)
          : undefined
        const instance = attempt
          ? instances.get(attempt.exerciseInstanceId)
          : undefined
        if (
          !item
          || item.outcome !== 'failure'
          || !item.attemptId
          || !item.exerciseInstanceId
          || !item.templateId
          || !item.templateVersion
          || !artifactAttemptIds.has(item.attemptId)
          || !attempt
          || attempt.result.passed
          || !instance
          || item.exerciseInstanceId !== instance.id
          || item.conceptId !== instance.conceptId
          || item.learningSkillId !== instance.learningSkillId
          || item.contentVersion !== instance.contentVersion
          || item.learningContractVersion !== instance.learningContractVersion
          || item.templateId !== instance.templateId
          || item.templateVersion !== instance.templateVersion
          || item.createdAt !== attempt.createdAt
          || attempt.recordedRevision > artifact.createdRevision
          || instance.conceptId !== artifact.conceptId
          || instance.learningSkillId !== artifact.learningSkillId
        ) {
          return null
        }
        if (
          learningContractVersion !== null
          && learningContractVersion !== instance.learningContractVersion
        ) {
          return null
        }
        learningContractVersion = instance.learningContractVersion
        evidenceAttemptIds.add(attempt.id)
      }

      for (const attemptId of artifact.attemptIds) {
        const attempt = attempts.get(attemptId)
        const instance = attempt
          ? instances.get(attempt.exerciseInstanceId)
          : undefined
        if (
          !attempt
          || attempt.result.passed
          || !instance
          || !evidenceAttemptIds.has(attemptId)
          || instance.conceptId !== artifact.conceptId
          || instance.learningSkillId !== artifact.learningSkillId
          || instance.learningContractVersion !== learningContractVersion
          || attempt.recordedRevision <= instance.recordedRevision
          || attempt.recordedRevision > artifact.createdRevision
        ) {
          return null
        }
      }

      return learningContractVersion === null
        ? null
        : {
            conceptId: artifact.conceptId,
            learningSkillId: artifact.learningSkillId,
            learningContractVersion,
          }
    },
  }
}
