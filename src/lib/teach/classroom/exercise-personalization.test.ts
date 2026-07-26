import { describe, expect, it } from 'vitest'
import type { ExerciseTemplate } from './content-packs'
import { personalizeExerciseTemplate } from './exercise-personalization'

function codeTemplate(
  starterCode: string,
  hints: string[],
): ExerciseTemplate {
  return {
    id: 'template:practice',
    version: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    learningSkillId: 'skill:practice',
    purpose: 'practice',
    task: {
      type: 'code_output',
      prompt: 'Complete the program.',
      starterCode,
      expectedOutput: '42',
      matchMode: 'exact',
      sourceRequirements: [{ type: 'top_level_main' }],
      hints,
    },
  }
}

describe('exercise personalization', () => {
  it('rejects Hard when removing the starter would be a cosmetic no-op', () => {
    expect(() => personalizeExerciseTemplate(
      codeTemplate('', ['Use main.']),
      {
        difficultyTarget: 'hard',
        unresolvedFailureEvidenceIds: [],
        remediationArtifactIds: [],
      },
    )).toThrow(/no authored hard scaffolding variant/)

    expect(() => personalizeExerciseTemplate(
      codeTemplate('   ', ['Use main.']),
      {
        difficultyTarget: 'hard',
        unresolvedFailureEvidenceIds: [],
        remediationArtifactIds: [],
      },
    )).toThrow(/no authored hard scaffolding variant/)
  })
})
