import type { ReviewArtifactKind } from '@/lib/ai/classroom/types'
import type { ConceptValidationStatus } from '@/lib/ai/course-content/types'

export const CLARIFICATION_PROGRESS_EFFECT = 'does_not_update_concept_progress' as const

type RetainableConceptStatus = Exclude<ConceptValidationStatus, 'invalid'>
type ClarificationArtifactKind = Extract<ReviewArtifactKind, 'clarification' | 'read_only_clarification'>

export type ClarificationRetentionTarget
  = | {
    ok: true
    conceptId: string
    conceptStatus: RetainableConceptStatus
    artifactKind: ClarificationArtifactKind
    progressEffect: typeof CLARIFICATION_PROGRESS_EFFECT
  }
  | {
    ok: false
    error: string
  }

export function resolveClarificationRetentionTarget({
  conceptId,
  activeConceptId,
  currentExerciseConceptIds,
  trackTargetConceptId,
  conceptStatuses,
}: {
  conceptId?: string
  activeConceptId?: string
  currentExerciseConceptIds?: string[]
  trackTargetConceptId?: string | null
  conceptStatuses: Record<string, ConceptValidationStatus | undefined>
}): ClarificationRetentionTarget {
  const targetConceptId = conceptId ?? activeConceptId ?? currentExerciseConceptIds?.[0] ?? trackTargetConceptId
  if (!targetConceptId)
    return { ok: false, error: 'No active concept to retain this clarification under.' }

  const conceptStatus = conceptStatuses[targetConceptId]
  if (!conceptStatus || conceptStatus === 'invalid') {
    return {
      ok: false,
      error: `Concept "${targetConceptId}" is not available for retained Review Artifacts.`,
    }
  }

  return {
    ok: true,
    conceptId: targetConceptId,
    conceptStatus,
    artifactKind: conceptStatus === 'validated' ? 'clarification' : 'read_only_clarification',
    progressEffect: CLARIFICATION_PROGRESS_EFFECT,
  }
}
