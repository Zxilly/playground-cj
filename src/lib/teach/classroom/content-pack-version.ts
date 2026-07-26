import { createHash } from 'node:crypto'
import type { CourseContentPack, ExerciseTask } from './content-packs'
import { canonicalJson } from './canonical-json'

export { canonicalJson } from './canonical-json'

export function sha256Canonical(value: unknown): string {
  return createHash('sha256')
    .update(canonicalJson(value), 'utf8')
    .digest('hex')
}

function sortedCanonical<T>(values: readonly T[]): T[] {
  return [...values].sort((left, right) =>
    canonicalJson(left).localeCompare(canonicalJson(right)))
}

function normalizedAnswerText(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ')
}

function normalizedExpectedOutput(value: string): string {
  return value.replace(/\s+$/u, '')
}

/**
 * Project a localized task onto only the invariants that affect what skill is
 * assessed and how its result is deterministically evaluated.
 *
 * Prompt, starter code, hints, question text, and explanations are
 * presentation content. Accepted recall answers and quiz options participate:
 * changing either can change what the deterministic evaluator accepts or what
 * a correct answer means.
 */
function learningContractTask(task: ExerciseTask): unknown {
  if (task.type === 'code_output') {
    return {
      type: task.type,
      expectedOutput: normalizedExpectedOutput(task.expectedOutput),
      matchMode: task.matchMode,
      sourceRequirements: sortedCanonical(task.sourceRequirements),
    }
  }
  if (task.type === 'quiz') {
    return {
      type: task.type,
      questions: task.questions.map(question => ({
        options: question.options.map(normalizedAnswerText),
        answerIndices: [...question.answerIndices].sort((left, right) => left - right),
        multiple: question.multiple,
      })),
    }
  }
  return {
    type: task.type,
    referenceAnswer: normalizedAnswerText(task.referenceAnswer),
  }
}

/**
 * Derive the learning/evaluator revision from the canonical English
 * curriculum. Callers must not independently hash a translated pack: accepted
 * answers and quiz options are evaluator semantics but are necessarily
 * localized. Bilingual assignment below validates locale structure and copies
 * this one canonical revision to both artifacts.
 */
function deriveCanonicalLearningContractVersion(
  pack: CourseContentPack,
): string {
  const fingerprintInput = {
    schemaVersion: 1,
    concept: {
      id: pack.concept.id,
      prerequisites: [...pack.concept.prerequisites].sort(),
    },
    learningSkills: [...pack.learningSkills]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(skill => ({
        id: skill.id,
        conceptId: skill.conceptId,
        key: skill.key,
      })),
    exerciseTemplates: [...pack.exerciseTemplates]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(template => ({
        id: template.id,
        learningSkillId: template.learningSkillId,
        purpose: template.purpose,
        task: learningContractTask(template.task),
      })),
  }
  const digest = sha256Canonical(fingerprintInput)
  return `lc:sha256:${digest}`
}

function bilingualStructure(pack: CourseContentPack): unknown {
  return {
    packId: pack.id,
    concept: {
      id: pack.concept.id,
      prerequisites: [...pack.concept.prerequisites].sort(),
    },
    learningSkills: [...pack.learningSkills]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(skill => ({
        id: skill.id,
        conceptId: skill.conceptId,
        key: skill.key,
      })),
    exerciseTemplates: [...pack.exerciseTemplates]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(template => ({
        id: template.id,
        learningSkillId: template.learningSkillId,
        purpose: template.purpose,
        task: template.task.type === 'code_output'
          ? {
              type: template.task.type,
              expectedOutput: normalizedExpectedOutput(
                template.task.expectedOutput,
              ),
              matchMode: template.task.matchMode,
              sourceRequirements: sortedCanonical(template.task.sourceRequirements),
            }
          : template.task.type === 'quiz'
            ? {
                type: template.task.type,
                questions: template.task.questions.map(question => ({
                  answerIndices: [...question.answerIndices]
                    .sort((left, right) => left - right),
                  multiple: question.multiple,
                  optionCount: question.options.length,
                })),
              }
            : { type: template.task.type },
      })),
  }
}

/**
 * Assign one canonical semantic revision to structurally aligned bilingual
 * packs. English is the canonical evaluator vocabulary; translated prompts,
 * answers, and options cannot create a locale-specific evidence boundary.
 */
export function assignBilingualLearningContractVersions(
  englishPacks: readonly CourseContentPack[],
  chinesePacks: readonly CourseContentPack[],
): { en: CourseContentPack[], zh: CourseContentPack[] } {
  const englishConceptIds = new Set(englishPacks.map(pack => pack.concept.id))
  const chineseByConcept = new Map(chinesePacks.map(pack => [pack.concept.id, pack]))
  if (
    englishConceptIds.size !== englishPacks.length
    || chineseByConcept.size !== chinesePacks.length
    || englishPacks.length !== chinesePacks.length
  ) {
    throw new Error('Bilingual Course Content Packs have mismatched Concept identities')
  }

  const en: CourseContentPack[] = []
  const zh: CourseContentPack[] = []
  for (const english of englishPacks) {
    const chinese = chineseByConcept.get(english.concept.id)
    if (!chinese) {
      throw new Error(
        `Chinese Course Content Pack is missing Concept ${english.concept.id}`,
      )
    }
    if (canonicalJson(bilingualStructure(english))
      !== canonicalJson(bilingualStructure(chinese))) {
      throw new Error(
        `Bilingual Learning Contract structure differs for ${english.concept.id}`,
      )
    }
    const learningContractVersion
      = deriveCanonicalLearningContractVersion(english)
    en.push({ ...english, learningContractVersion })
    zh.push({ ...chinese, learningContractVersion })
  }
  return { en, zh }
}

/**
 * Assign a collision-resistant content identity. Repository review declaration
 * metadata is deliberately external to teaching content and therefore
 * excluded, along with the recursive pack/template version fields.
 */
export function assignImmutableContentVersion(
  pack: CourseContentPack,
  locale: 'zh' | 'en',
): CourseContentPack {
  if (pack.learningContractVersion === 'unversioned') {
    throw new Error(
      `Course Content Pack ${pack.concept.id} has no assigned Learning Contract Version`,
    )
  }
  const fingerprintInput = {
    locale,
    ...pack,
    version: undefined,
    learningContractVersion: pack.learningContractVersion,
    review: undefined,
    exerciseTemplates: pack.exerciseTemplates.map(template => ({
      ...template,
      version: undefined,
    })),
  }
  const digest = sha256Canonical(fingerprintInput)
  const version = `cv:sha256:${digest}`
  return {
    ...pack,
    version,
    exerciseTemplates: pack.exerciseTemplates.map(template => ({
      ...template,
      version,
    })),
  }
}
