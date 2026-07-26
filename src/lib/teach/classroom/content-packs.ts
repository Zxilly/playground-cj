import { z } from 'zod'
import { canonicalJson } from './canonical-json'

export type ContentPackLanguage = 'zh' | 'en'

export const MAX_CONTENT_PACK_ID_LENGTH = 200
export const MAX_CONTENT_PACK_BLOCKS = 48
export const MAX_CONTENT_PACK_LEARNING_SKILLS = 32
export const MAX_CONTENT_PACK_EXERCISE_TEMPLATES = 32
export const MAX_TEACHER_READABLE_CONTENT_PACK_CHARACTERS = 80_000

export const contentPackIdSchema = z.string()
  .min(1)
  .max(MAX_CONTENT_PACK_ID_LENGTH)
  .refine(
    value => value === value.trim(),
    'identifier must not contain leading or trailing whitespace',
  )
  .refine(
    value => [...value].every((character) => {
      const codePoint = character.codePointAt(0)
      return codePoint !== undefined
        && codePoint > 0x1F
        && codePoint !== 0x7F
    }),
    'identifier must not contain control characters',
  )
const idSchema = contentPackIdSchema
const displayTextSchema = z.string().trim().min(1).max(20_000)
const externalReviewIdentitySchema = z.string().regex(
  /^external-review-attestation:[\w.-]{1,64}:[a-f0-9]{64}$/,
  'approved content requires a trusted external review attestation',
)
export const contentVersionSchema = z.string().max(128).regex(
  /^cv:sha256:[a-f0-9]{64}$/,
  'Content Version must use cv:sha256:<64 lowercase hex>',
)
export const learningContractVersionSchema = z.string().max(128).regex(
  /^lc:sha256:[a-f0-9]{64}$/,
  'Learning Contract Version must use lc:sha256:<64 lowercase hex>',
)
const staticTourRefSchema = z.string().trim().max(512).regex(
  /^\d+-[a-z0-9-]+\/\d+-[a-z0-9-]+\/\d+$/,
  'Source Reference must use chapterId/subChapterId/sectionId',
)

export const sourceReferenceSchema = z.object({
  sourceId: z.literal('static-tour'),
  ref: staticTourRefSchema,
  title: displayTextSchema,
}).strict()
export type SourceReference = z.infer<typeof sourceReferenceSchema>

const coreContentBlockBaseSchema = z.object({
  id: idSchema,
  sourceReferences: z.array(sourceReferenceSchema).min(1).max(16),
}).strict()

export const coreContentBlockSchema = z.discriminatedUnion('type', [
  coreContentBlockBaseSchema.extend({
    type: z.literal('prose'),
    markdown: z.string().trim().min(1).max(100_000),
  }).strict(),
  coreContentBlockBaseSchema.extend({
    type: z.literal('code_sample'),
    code: z.string().trim().min(1).max(100_000),
    language: z.literal('cangjie'),
    sampleType: z.enum(['program', 'snippet']),
    explanation: displayTextSchema.optional(),
  }).strict(),
])
export type CoreContentBlock = z.infer<typeof coreContentBlockSchema>

export const learningSkillSchema = z.object({
  id: idSchema,
  conceptId: idSchema,
  title: displayTextSchema,
  description: displayTextSchema,
  key: z.boolean().default(true),
}).strict()
export type LearningSkill = z.infer<typeof learningSkillSchema>

const cangjieIdentifierSchema = z.string().max(128).regex(
  /^[a-z_]\w*$/i,
  'must be a simple Cangjie identifier',
)

export const sourceRequirementSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('top_level_main'),
  }).strict(),
  z.object({
    type: z.literal('binding'),
    binding: z.enum(['let', 'var']),
    name: cangjieIdentifierSchema,
  }).strict(),
  z.object({
    type: z.literal('call_identifier'),
    // The current deterministic introductory evaluator knows how to prove an
    // unqualified call only for the built-in output function. Expanding this
    // vocabulary requires symbol resolution, not a looser string matcher.
    functionName: z.literal('println'),
    argumentName: cangjieIdentifierSchema,
  }).strict(),
  z.object({
    type: z.literal('reassignment'),
    name: cangjieIdentifierSchema,
  }).strict(),
  z.object({
    type: z.literal('integer_binding'),
    binding: z.enum(['let', 'var']),
    name: cangjieIdentifierSchema,
    value: z.number().int().safe(),
  }).strict(),
  z.object({
    type: z.literal('binary_integer_binding'),
    binding: z.enum(['let', 'var']),
    name: cangjieIdentifierSchema,
    leftName: cangjieIdentifierSchema,
    operator: z.enum(['+', '-', '*']),
    rightValue: z.number().int().safe(),
  }).strict(),
  z.object({
    type: z.literal('add_integer_reassignment'),
    name: cangjieIdentifierSchema,
    amount: z.number().int().safe(),
  }).strict(),
])
export type SourceRequirement = z.infer<typeof sourceRequirementSchema>

const codeOutputTaskSchema = z.object({
  type: z.literal('code_output'),
  prompt: displayTextSchema,
  starterCode: z.string().max(32_000),
  expectedOutput: z.string().max(32_000),
  matchMode: z.enum(['exact', 'contains']),
  sourceRequirements: z.array(sourceRequirementSchema).min(1).max(12),
  hints: z.array(displayTextSchema).max(3).default([]),
}).strict()

const recallTaskSchema = z.object({
  type: z.literal('recall'),
  prompt: displayTextSchema,
  referenceAnswer: displayTextSchema,
}).strict()

const quizQuestionSchema = z.object({
  question: displayTextSchema,
  options: z.array(displayTextSchema).min(2).max(5),
  answerIndices: z.array(z.number().int().nonnegative()).min(1),
  multiple: z.boolean(),
  explanation: displayTextSchema,
}).strict().superRefine((question, ctx) => {
  if (new Set(question.options).size !== question.options.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['options'],
      message: 'quiz options must be unique',
    })
  }
  if (question.answerIndices.some(index => index >= question.options.length)) {
    ctx.addIssue({
      code: 'custom',
      path: ['answerIndices'],
      message: 'answer index is outside the option list',
    })
  }
  if (new Set(question.answerIndices).size !== question.answerIndices.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['answerIndices'],
      message: 'quiz answer indices must be unique',
    })
  }
  if (!question.multiple && question.answerIndices.length !== 1) {
    ctx.addIssue({
      code: 'custom',
      path: ['answerIndices'],
      message: 'single-answer questions require exactly one answer',
    })
  }
})

const quizTaskSchema = z.object({
  type: z.literal('quiz'),
  questions: z.array(quizQuestionSchema).min(1).max(8),
}).strict().superRefine((task, ctx) => {
  const identities = task.questions.map(question => JSON.stringify(question))
  if (new Set(identities).size !== identities.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['questions'],
      message: 'quiz questions must be unique',
    })
  }
})

export const exerciseTaskSchema = z.discriminatedUnion('type', [
  codeOutputTaskSchema,
  recallTaskSchema,
  quizTaskSchema,
]).superRefine((task, ctx) => {
  if (
    task.type === 'code_output'
    && task.matchMode === 'contains'
    && task.expectedOutput.trim().length === 0
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['expectedOutput'],
      message: 'contains matching requires a non-empty expected output',
    })
  }
})
export type ExerciseTask = z.infer<typeof exerciseTaskSchema>

/**
 * A locale-neutral projection of the deterministic assessment form.
 *
 * Code output and structural requirements are already required to align
 * across locales. Quiz text and recall answers may be translated, so their
 * projection deliberately uses only the evaluator structure that bilingual
 * validation proves equivalent. This can conservatively reject a legitimate
 * transfer form; it must never certify a translated or repeated copy as a
 * distinct review contract.
 */
export function assessmentContractFingerprint(task: ExerciseTask): string {
  if (task.type === 'code_output') {
    // Source-shape or matcher changes do not prove that a prior solution must
    // change. Exact output inequality is the only code-output distinction this
    // local evaluator can conservatively certify.
    return canonicalJson({
      type: task.type,
      matchMode: task.matchMode,
      expectedOutput: task.matchMode === 'exact'
        ? task.expectedOutput.replace(/\s+$/u, '')
        : null,
    })
  }
  if (task.type === 'quiz') {
    // Quiz submissions contain only one answer-index set per question. Option
    // text/count and the presentation-only `multiple` flag cannot prove that
    // a previously correct submission must change.
    return canonicalJson({
      type: task.type,
      questions: task.questions.map(question =>
        [...question.answerIndices].sort((left, right) => left - right)),
    })
  }
  return canonicalJson({ type: task.type })
}

export function hasDistinctAssessmentContract(
  prior: { templateId: string, task: ExerciseTask },
  current: { templateId: string, task: ExerciseTask },
): boolean {
  if (prior.templateId === current.templateId)
    return false
  if (prior.task.type !== current.task.type)
    return true
  if (
    prior.task.type === 'code_output'
    && current.task.type === 'code_output'
  ) {
    return prior.task.matchMode === 'exact'
      && current.task.matchMode === 'exact'
      && prior.task.expectedOutput.replace(/\s+$/u, '')
      !== current.task.expectedOutput.replace(/\s+$/u, '')
  }
  if (prior.task.type === 'recall' && current.task.type === 'recall')
    return false
  return assessmentContractFingerprint(prior.task)
    !== assessmentContractFingerprint(current.task)
}

export const exerciseTemplateSchema = z.object({
  id: idSchema,
  version: contentVersionSchema,
  learningSkillId: idSchema,
  purpose: z.enum(['practice', 'placement', 'review']),
  task: exerciseTaskSchema,
}).strict()
export type ExerciseTemplate = z.infer<typeof exerciseTemplateSchema>

export const courseContentPackObjectSchema = z.object({
  id: idSchema,
  version: contentVersionSchema,
  /**
   * Locale-neutral identity of the skills and deterministic evaluator
   * contract. Content Version remains the exact, locale-specific artifact
   * identity.
   */
  learningContractVersion: learningContractVersionSchema,
  concept: z.object({
    id: idSchema,
    title: displayTextSchema,
    summary: displayTextSchema,
    prerequisites: z.array(idSchema).max(64),
  }).strict(),
  blocks: z.array(coreContentBlockSchema).min(1).max(MAX_CONTENT_PACK_BLOCKS),
  learningSkills: z.array(learningSkillSchema)
    .max(MAX_CONTENT_PACK_LEARNING_SKILLS),
  exerciseTemplates: z.array(exerciseTemplateSchema)
    .max(MAX_CONTENT_PACK_EXERCISE_TEMPLATES),
  review: z.discriminatedUnion('status', [
    z.object({
      status: z.literal('pending'),
    }).strict(),
    z.object({
      status: z.literal('approved'),
      reviewedBy: externalReviewIdentitySchema,
    }).strict(),
  ]),
}).strict()

export const courseContentPackSchema = courseContentPackObjectSchema
  .superRefine((pack, ctx) => {
  // The teacher receives this exact learner-visible projection in one bounded
  // read. Keeping the publication limit here prevents a valid pack from
  // containing selectable blocks or templates whose meaning was omitted only
  // because a transport projection ran out of space.
    const visibleStrings = [
      pack.id,
      pack.version,
      pack.learningContractVersion,
      pack.concept.id,
      pack.concept.title,
      pack.concept.summary,
      ...pack.concept.prerequisites,
    ]
    for (const skill of pack.learningSkills) {
      visibleStrings.push(
        skill.id,
        skill.conceptId,
        skill.title,
        skill.description,
      )
    }
    for (const template of pack.exerciseTemplates) {
      visibleStrings.push(
        template.id,
        template.version,
        template.learningSkillId,
      )
      if (template.task.type === 'code_output') {
        visibleStrings.push(template.task.prompt, template.task.starterCode)
      }
      else if (template.task.type === 'recall') {
        visibleStrings.push(template.task.prompt)
      }
      else {
        for (const question of template.task.questions)
          visibleStrings.push(question.question, ...question.options)
      }
    }
    for (const block of pack.blocks) {
      visibleStrings.push(block.id)
      if (block.type === 'prose')
        visibleStrings.push(block.markdown)
      else
        visibleStrings.push(block.code, block.explanation ?? '')
      for (const reference of block.sourceReferences) {
        visibleStrings.push(
          reference.sourceId,
          reference.ref,
          reference.title,
        )
      }
    }
    const visibleCharacters = visibleStrings.reduce(
      (total, value) => total + value.length,
      0,
    )
    if (visibleCharacters > MAX_TEACHER_READABLE_CONTENT_PACK_CHARACTERS) {
      ctx.addIssue({
        code: 'custom',
        path: [],
        message: 'teacher-readable Content Pack projection exceeds '
          + `${MAX_TEACHER_READABLE_CONTENT_PACK_CHARACTERS} characters`,
      })
    }
  })
export type CourseContentPack = z.infer<typeof courseContentPackSchema>

export const contentPacksResponseSchema = z.object({
  packs: z.array(courseContentPackSchema).max(1_024),
  currentVersions: z.record(idSchema, contentVersionSchema),
}).strict().superRefine((response, ctx) => {
  if (Object.keys(response.currentVersions).length > 1_024) {
    ctx.addIssue({
      code: 'custom',
      path: ['currentVersions'],
      message: 'current Content Version index exceeds 1024 Concepts',
    })
  }
  const versionsByConcept = new Map<string, Set<string>>()
  const identities = new Set<string>()

  for (const pack of response.packs) {
    const identity = `${pack.concept.id}\0${pack.version}`
    if (identities.has(identity)) {
      ctx.addIssue({
        code: 'custom',
        path: ['packs'],
        message: `duplicate Concept Version ${pack.concept.id}@${pack.version}`,
      })
    }
    identities.add(identity)

    const versions = versionsByConcept.get(pack.concept.id) ?? new Set<string>()
    versions.add(pack.version)
    versionsByConcept.set(pack.concept.id, versions)
  }

  for (const [conceptId, versions] of versionsByConcept) {
    const currentVersion = response.currentVersions[conceptId]
    if (!currentVersion) {
      ctx.addIssue({
        code: 'custom',
        path: ['currentVersions', conceptId],
        message: `Concept ${conceptId} requires an explicit current Content Version`,
      })
    }
    else if (!versions.has(currentVersion)) {
      ctx.addIssue({
        code: 'custom',
        path: ['currentVersions', conceptId],
        message: `current Content Version ${conceptId}@${currentVersion} is absent`,
      })
    }
  }

  for (const conceptId of Object.keys(response.currentVersions)) {
    if (!versionsByConcept.has(conceptId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['currentVersions', conceptId],
        message: `current Content Version references absent Concept ${conceptId}`,
      })
    }
  }
})
export type ContentPacksResponse = z.infer<typeof contentPacksResponseSchema>

export type ContentPackValidation
  = | { status: 'invalid', issues: string[] }
    | { status: 'read_only', pack: CourseContentPack }
    | { status: 'validated', pack: CourseContentPack }

function duplicateIds(ids: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const id of ids) {
    if (seen.has(id))
      duplicates.add(id)
    seen.add(id)
  }
  return [...duplicates]
}

/**
 * Enforce the Content Pack Validation gate used by the AI Classroom runtime.
 * Parsing alone is insufficient: this also checks cross-record links and stable
 * identity, which are the invariants a model-authored lesson could previously
 * bypass.
 */
export function validateContentPack(input: unknown): ContentPackValidation {
  const parsed = courseContentPackSchema.safeParse(input)
  if (!parsed.success) {
    return {
      status: 'invalid',
      issues: parsed.error.issues.map(issue =>
        `${issue.path.join('.') || 'pack'}: ${issue.message}`),
    }
  }

  const pack = parsed.data
  const issues: string[] = []
  for (const duplicate of duplicateIds(pack.blocks.map(block => block.id)))
    issues.push(`duplicate Core Content Block id ${duplicate}`)
  for (const duplicate of duplicateIds(pack.learningSkills.map(skill => skill.id)))
    issues.push(`duplicate Learning Skill id ${duplicate}`)
  for (const duplicate of duplicateIds(pack.exerciseTemplates.map(template => template.id)))
    issues.push(`duplicate Exercise Template id ${duplicate}`)

  const skills = new Set(pack.learningSkills.map(skill => skill.id))
  for (const skill of pack.learningSkills) {
    if (skill.conceptId !== pack.concept.id)
      issues.push(`Learning Skill ${skill.id} belongs to ${skill.conceptId}, not ${pack.concept.id}`)
  }
  for (const template of pack.exerciseTemplates) {
    if (!skills.has(template.learningSkillId))
      issues.push(`Exercise Template ${template.id} references missing Learning Skill ${template.learningSkillId}`)
  }

  if (issues.length > 0)
    return { status: 'invalid', issues }

  const hasEvidenceLoop = pack.learningSkills.length > 0
    && pack.blocks.some(block =>
      block.type === 'code_sample' && block.sampleType === 'program')
    && pack.learningSkills.every((skill) => {
      const practiceTemplates = pack.exerciseTemplates.filter(template =>
        template.learningSkillId === skill.id && template.purpose === 'practice')
      const placementTemplates = pack.exerciseTemplates.filter(template =>
        template.learningSkillId === skill.id && template.purpose === 'placement')
      const reviewTemplates = pack.exerciseTemplates.filter(template =>
        template.learningSkillId === skill.id && template.purpose === 'review')
      return practiceTemplates.length > 0
        && reviewTemplates.length > 0
        && reviewTemplates.every((reviewTemplate, reviewIndex) =>
          [...practiceTemplates, ...placementTemplates].every(priorTemplate =>
            hasDistinctAssessmentContract(
              { templateId: priorTemplate.id, task: priorTemplate.task },
              { templateId: reviewTemplate.id, task: reviewTemplate.task },
            ))
            && reviewTemplates.every((otherReview, otherIndex) =>
              reviewIndex === otherIndex
              || hasDistinctAssessmentContract(
                { templateId: otherReview.id, task: otherReview.task },
                { templateId: reviewTemplate.id, task: reviewTemplate.task },
              )))
    })

  if (pack.review.status !== 'approved' || !pack.review.reviewedBy || !hasEvidenceLoop)
    return { status: 'read_only', pack }

  return { status: 'validated', pack }
}
