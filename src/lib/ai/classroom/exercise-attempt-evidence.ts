import type { EvidenceOutcome, EvidenceStrength, ExerciseIntent } from './types'

export type ExerciseAttemptAssistanceKind = 'code_suggestion'

export interface ExerciseAttemptAssistance {
  kind: ExerciseAttemptAssistanceKind
  appliedAt: number
}

export interface ExerciseAttemptEvidenceInput {
  assistance?: ExerciseAttemptAssistance[]
}

export function createCodeSuggestionAssistance(appliedAt: number): ExerciseAttemptAssistance {
  return {
    kind: 'code_suggestion',
    appliedAt,
  }
}

export function attemptHasMeaningfulAssistance(attempt?: ExerciseAttemptEvidenceInput | null): boolean {
  return (attempt?.assistance ?? []).length > 0
}

export function evidenceStrengthForExerciseAttempt(
  outcome: EvidenceOutcome,
  attempt?: ExerciseAttemptEvidenceInput | null,
  options: { exerciseIntent?: ExerciseIntent } = {},
): EvidenceStrength {
  const aided = attemptHasMeaningfulAssistance(attempt)
  if (outcome === 'success' && options.exerciseIntent === 'review_check' && !aided)
    return 'mastery'

  if (outcome === 'success' || outcome === 'failure')
    return aided ? 'aided' : 'independent'

  return 'self_report'
}
