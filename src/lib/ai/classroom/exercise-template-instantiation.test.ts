import { describe, expect, it } from 'vitest'
import { getDefaultCourseContentIndex } from '@/lib/ai/course-content/loader'
import { instantiateExerciseTemplate } from './exercise-template-instantiation'

describe('exercise template instantiation', () => {
  it('creates an Exercise Instance payload from template-owned task fields', () => {
    const template = getDefaultCourseContentIndex().getExerciseTemplate('cj.var.immutable.choose-let.answer')!

    const exercise = instantiateExerciseTemplate({
      template,
      lang: 'en',
      personalizationInputs: {
        conceptProgress: ['cj.var.immutable is practicing'],
        recentErrorPatterns: ['reassigned let once'],
        difficultyTarget: 2,
      },
    })

    expect(exercise).toMatchObject({
      templateId: template.templateId,
      templateVersion: template.templateVersion,
      skillId: template.skillId,
      conceptIds: template.conceptIds,
      prompt: template.prompt.en,
      starterCode: template.starterCode,
      expectedOutput: template.expectedOutput,
      matchMode: template.matchMode,
      intent: template.intent,
      personalizationInputs: {
        difficulty: 2,
      },
    })
    expect(exercise.personalizationInputs.summary).toContain('concept progress: cj.var.immutable is practicing')
    expect(exercise.personalizationInputs.summary).toContain('recent error patterns: reassigned let once')
  })

  it('defaults personalization to template difficulty without creating freeform task text', () => {
    const template = getDefaultCourseContentIndex().getExerciseTemplate('cj.program.main.write-entry.hello')!

    const exercise = instantiateExerciseTemplate({ template, lang: 'zh' })

    expect(exercise.prompt).toBe(template.prompt.zh)
    expect(exercise.starterCode).toBe(template.starterCode)
    expect(exercise.expectedOutput).toBe(template.expectedOutput)
    expect(exercise.personalizationInputs).toEqual({
      summary: 'Selected directly from Exercise Template.',
      difficulty: template.difficulty,
    })
  })

  it('can create a review check instance while keeping task fields template-owned', () => {
    const template = getDefaultCourseContentIndex().getExerciseTemplate('cj.io.println.print-value.cangjie')!

    const exercise = instantiateExerciseTemplate({ template, lang: 'zh', intent: 'review_check' })

    expect(exercise).toMatchObject({
      templateId: template.templateId,
      prompt: template.prompt.zh,
      starterCode: template.starterCode,
      expectedOutput: template.expectedOutput,
      matchMode: template.matchMode,
      intent: 'review_check',
    })
  })
})
