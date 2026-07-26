import type { ExerciseTask, ExerciseTemplate } from './content-packs'
import type { PersonalizationInputs } from './state'

export const EXERCISE_PERSONALIZATION_POLICY_VERSION = 2 as const

export type EffectiveExerciseDifficulty
  = | 'standard'
    | 'easy'
    | 'hard'

export interface PersonalizedExercise {
  policyVersion: typeof EXERCISE_PERSONALIZATION_POLICY_VERSION
  effectiveDifficulty: EffectiveExerciseDifficulty
  task: ExerciseTask
}

function hasReferencedSupport(inputs: PersonalizationInputs): boolean {
  return inputs.unresolvedFailureEvidenceIds.length > 0
    || inputs.remediationArtifactIds.length > 0
}

/**
 * Apply the one versioned, deterministic personalization policy.
 *
 * The policy can change scaffolding only; evaluator requirements and expected
 * answers remain exactly those authored by the immutable Exercise Template.
 * Persisting both the generated task and policy version keeps old instances
 * explainable and lets integrity re-derive them without trusting model text.
 */
export function personalizeExerciseTemplate(
  template: ExerciseTemplate,
  inputs: PersonalizationInputs,
): PersonalizedExercise {
  const requested = inputs.difficultyTarget
  const referencedSupport = hasReferencedSupport(inputs)
  const hasPersonalization = requested !== undefined || referencedSupport

  if (template.purpose === 'placement' && hasPersonalization) {
    throw new Error(
      'Placement Checks are standardized and do not accept Personalization Inputs',
    )
  }
  if (template.task.type !== 'code_output' && hasPersonalization) {
    throw new Error(
      'This Exercise Template has no validated personalization policy',
    )
  }
  if (referencedSupport && requested === 'hard') {
    throw new Error(
      'Hard scaffolding cannot be combined with failure or Remediation support',
    )
  }

  const effectiveDifficulty: EffectiveExerciseDifficulty
    = referencedSupport ? 'easy' : (requested ?? 'standard')
  const task = structuredClone(template.task)
  if (task.type === 'code_output') {
    if (effectiveDifficulty === 'standard')
      task.hints = []
    if (effectiveDifficulty === 'easy' && task.hints.length === 0) {
      throw new Error(
        'This Exercise Template has no authored easy scaffolding variant',
      )
    }
    if (effectiveDifficulty === 'hard') {
      if (task.starterCode.trim().length === 0) {
        throw new Error(
          'This Exercise Template has no authored hard scaffolding variant',
        )
      }
      task.starterCode = ''
      task.hints = []
    }
  }

  return {
    policyVersion: EXERCISE_PERSONALIZATION_POLICY_VERSION,
    effectiveDifficulty,
    task,
  }
}
