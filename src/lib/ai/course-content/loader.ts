import type { CoreContentBlock, CourseContentBlockContent, CourseContentPack, ExerciseTemplate, LearningSkill } from './types'
import { assertValidCourseContentPack, validateCourseContentPack } from './validation'
import { defaultEntryCourseContentPack } from './default-entry-pack'

export function createCourseContentIndex(pack: CourseContentPack) {
  assertValidCourseContentPack(pack)
  const blocksById = new Map(pack.blocks.map(block => [block.blockId, block]))
  const conceptsById = new Map(pack.concepts.map(concept => [concept.conceptId, concept]))
  const skillsById = new Map(pack.skills.map(skill => [skill.skillId, skill]))
  const templatesById = new Map(pack.exerciseTemplates.map(template => [template.templateId, template]))

  function getBlocksForConcept(conceptId: string): CoreContentBlock[] {
    return pack.blocks
      .filter(block => block.conceptId === conceptId)
      .sort((a, b) => a.order - b.order)
  }

  function getSkillsForConcept(conceptId: string): LearningSkill[] {
    return pack.skills.filter(skill => skill.conceptIds.includes(conceptId))
  }

  function getExerciseTemplatesForSkill(skillId: string): ExerciseTemplate[] {
    return pack.exerciseTemplates.filter(template => template.skillId === skillId)
  }

  return {
    pack,
    validation: validateCourseContentPack(pack),
    getConcept: (conceptId: string) => conceptsById.get(conceptId),
    getBlock: (blockId: string) => blocksById.get(blockId),
    getSkill: (skillId: string) => skillsById.get(skillId),
    getExerciseTemplate: (templateId: string) => templatesById.get(templateId),
    getBlocksForConcept,
    getSkillsForConcept,
    getExerciseTemplatesForSkill,
  }
}

let defaultEntryIndex: ReturnType<typeof createCourseContentIndex> | null = null

export function getDefaultCourseContentPack(): CourseContentPack {
  return defaultEntryCourseContentPack
}

export function getDefaultCourseContentIndex(): ReturnType<typeof createCourseContentIndex> {
  defaultEntryIndex ??= createCourseContentIndex(defaultEntryCourseContentPack)
  return defaultEntryIndex
}

export function getLocalizedBlockContent(block: CoreContentBlock, lang: string): CourseContentBlockContent {
  return lang === 'en'
    ? block.localizedContent?.en ?? block.content
    : block.localizedContent?.zh ?? block.content
}
