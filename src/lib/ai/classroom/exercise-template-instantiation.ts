import type { ExerciseInstance, ExerciseIntent } from './types'
import type { ExerciseTemplate } from '@/lib/ai/course-content/types'

export interface ExercisePersonalizationInputs {
  conceptProgress?: string[]
  recentErrorPatterns?: string[]
  retainedRemediationSummaries?: string[]
  declaredBackground?: string[]
  difficultyTarget?: 1 | 2 | 3 | 4 | 5
  recentRelevantCodeSummaries?: string[]
}

export interface ExerciseTemplateInstantiationInput {
  template: ExerciseTemplate
  lang: 'zh' | 'en'
  intent?: ExerciseIntent
  personalizationInputs?: ExercisePersonalizationInputs
}

export type InstantiatedExercise = Omit<ExerciseInstance, 'id' | 'createdAt' | 'status'>

const PERSONALIZATION_FIELD_LABELS: Record<keyof Omit<ExercisePersonalizationInputs, 'difficultyTarget'>, string> = {
  conceptProgress: 'concept progress',
  recentErrorPatterns: 'recent error patterns',
  retainedRemediationSummaries: 'retained remediation summaries',
  declaredBackground: 'declared background',
  recentRelevantCodeSummaries: 'recent relevant code summaries',
}

export function instantiateExerciseTemplate(input: ExerciseTemplateInstantiationInput): InstantiatedExercise {
  const { template, lang, intent, personalizationInputs } = input
  const summary = summarizePersonalizationInputs(personalizationInputs)

  return {
    templateId: template.templateId,
    templateVersion: template.templateVersion,
    skillId: template.skillId,
    conceptIds: template.conceptIds,
    prompt: template.prompt[lang],
    starterCode: template.starterCode,
    expectedOutput: template.expectedOutput,
    matchMode: template.matchMode,
    intent: intent ?? template.intent,
    personalizationInputs: {
      summary,
      difficulty: personalizationInputs?.difficultyTarget ?? template.difficulty,
    },
  }
}

export function summarizePersonalizationInputs(inputs: ExercisePersonalizationInputs | undefined): string {
  if (!inputs)
    return 'Selected directly from Exercise Template.'

  const parts: string[] = []
  for (const key of Object.keys(PERSONALIZATION_FIELD_LABELS) as Array<keyof typeof PERSONALIZATION_FIELD_LABELS>) {
    const values = inputs[key]
    if (values?.length)
      parts.push(`${PERSONALIZATION_FIELD_LABELS[key]}: ${values.join('; ')}`)
  }
  if (inputs.difficultyTarget)
    parts.push(`difficulty target: ${inputs.difficultyTarget}`)

  return parts.length > 0
    ? parts.join(' | ')
    : 'Selected directly from Exercise Template.'
}
