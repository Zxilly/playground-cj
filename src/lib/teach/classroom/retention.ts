import type { ReviewArtifact } from './state'
import { canonicalJson } from './canonical-json'
import { normalizeMisconceptionTheme } from './misconception-theme'

export function clarificationSuppressionKey(
  conceptId: string,
  contentVersion: string,
  misconceptionTheme: string,
): string {
  return canonicalJson([
    'clarification',
    conceptId,
    contentVersion,
    normalizeMisconceptionTheme(misconceptionTheme),
  ])
}

/** Active Clarifications are version-exact explanations, never mutable aliases. */
export function clarificationReviewGroupKey(
  conceptId: string,
  contentVersion: string,
  misconceptionTheme: string,
): string {
  return canonicalJson([
    'clarification-group',
    conceptId,
    contentVersion,
    normalizeMisconceptionTheme(misconceptionTheme),
  ])
}

export function remediationSuppressionKey(
  conceptId: string,
  learningSkillId: string,
  attemptIds: readonly string[],
): string {
  return canonicalJson([
    'remediation',
    conceptId,
    learningSkillId,
    [...attemptIds].sort(),
  ])
}

/** Learner-facing grouping key; unlike suppression, it spans attempt lineages. */
export function remediationReviewGroupKey(
  conceptId: string,
  learningSkillId: string,
  misconceptionTheme: string,
): string {
  return canonicalJson([
    'remediation-group',
    conceptId,
    learningSkillId,
    normalizeMisconceptionTheme(misconceptionTheme),
  ])
}

export interface ReviewArtifactGroup {
  key: string
  artifacts: ReviewArtifact[]
  representative: ReviewArtifact
  learningContractVersion: string | null
}

export interface ReviewArtifactGroupingContext {
  learningContractVersionFor: (
    artifact: Extract<ReviewArtifact, { type: 'remediation' }>,
  ) => string | null
}

/**
 * Review presents repeated ready Remediations as one misconception pattern
 * while preserving each failed-attempt lineage in the aggregate.
 */
export function groupReviewArtifacts(
  artifacts: readonly ReviewArtifact[],
  context: ReviewArtifactGroupingContext,
): ReviewArtifactGroup[] {
  const groups = new Map<string, ReviewArtifactGroup>()
  for (const artifact of artifacts) {
    const learningContractVersion = artifact.type === 'remediation'
      ? context.learningContractVersionFor(artifact)
      : null
    const key = artifact.type === 'remediation'
      && artifact.diagnosticStatus === 'ready'
      && artifact.misconceptionTheme !== null
      && learningContractVersion !== null
      ? canonicalJson([
          'remediation-contract-group',
          remediationReviewGroupKey(
            artifact.conceptId,
            artifact.learningSkillId,
            artifact.misconceptionTheme,
          ),
          learningContractVersion,
        ])
      : canonicalJson([artifact.type, artifact.id])
    const group = groups.get(key)
    if (!group) {
      groups.set(key, {
        key,
        artifacts: [artifact],
        representative: artifact,
        learningContractVersion,
      })
      continue
    }
    group.artifacts.push(artifact)
    if (artifact.updatedRevision >= group.representative.updatedRevision)
      group.representative = artifact
  }
  return [...groups.values()]
}
