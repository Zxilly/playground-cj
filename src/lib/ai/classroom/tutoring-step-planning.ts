import type { CoreContentBlock, ExerciseTemplate } from '@/lib/ai/course-content/types'
import type { createCourseContentIndex } from '@/lib/ai/course-content/loader'

type CourseContentIndex = ReturnType<typeof createCourseContentIndex>

export interface PlannedContentReferenceGroup {
  conceptId: string
  skillId?: string
  blockIds: string[]
}

export interface PlannedSkipMarker {
  conceptId: string
  blockIds: string[]
}

export function requireUsableCourseConcept(index: CourseContentIndex, conceptId: string, requireValidated: boolean) {
  const status = index.validation.conceptStatuses[conceptId]
  if (!status || status === 'invalid')
    throw new Error(`Concept "${conceptId}" is not available in validated Course Content.`)
  if (requireValidated && status !== 'validated')
    throw new Error(`Concept "${conceptId}" is ${status}; mainline orchestration requires a Validated Concept.`)
  return status
}

export function planContentReferenceGroup(
  index: CourseContentIndex,
  input: { conceptId: string, blockIds?: string[], skillId?: string },
): PlannedContentReferenceGroup {
  const { conceptId, blockIds, skillId } = input
  requireUsableCourseConcept(index, conceptId, Boolean(skillId))

  if (skillId && !index.getSkillsForConcept(conceptId).some(skill => skill.skillId === skillId))
    throw new Error(`Skill "${skillId}" is not linked to concept "${conceptId}".`)

  const selectedBlocks = blockIds?.length
    ? resolveConceptBlocks(index, conceptId, blockIds)
    : index.getBlocksForConcept(conceptId)

  if (selectedBlocks.length === 0)
    throw new Error(`No Core Content Blocks selected for concept "${conceptId}".`)

  return {
    conceptId,
    skillId,
    blockIds: sortByPackOrder(selectedBlocks).map(block => block.blockId),
  }
}

export function planSkipMarker(
  index: CourseContentIndex,
  input: { conceptId: string, blockIds: string[] },
): PlannedSkipMarker {
  const { conceptId, blockIds } = input
  requireUsableCourseConcept(index, conceptId, false)

  const selectedBlocks = resolveConceptBlocks(index, conceptId, blockIds)
  if (selectedBlocks.length === 0)
    throw new Error(`No Core Content Blocks selected for concept "${conceptId}".`)

  return {
    conceptId,
    blockIds: sortByPackOrder(selectedBlocks).map(block => block.blockId),
  }
}

export function assertTemplateBackedByValidatedConcepts(index: CourseContentIndex, template: ExerciseTemplate): void {
  if (!index.getSkill(template.skillId))
    throw new Error(`Exercise Template "${template.templateId}" references unknown skill "${template.skillId}".`)

  for (const conceptId of template.conceptIds)
    requireUsableCourseConcept(index, conceptId, true)

  if (!template.conceptIds.some(conceptId =>
    index.getSkillsForConcept(conceptId).some(skill => skill.skillId === template.skillId),
  )) {
    throw new Error(`Exercise Template "${template.templateId}" is not linked to a Validated Concept skill.`)
  }
}

function resolveConceptBlocks(index: CourseContentIndex, conceptId: string, blockIds: string[]): CoreContentBlock[] {
  const missing: string[] = []
  const wrongConcept: string[] = []
  const seen = new Set<string>()
  const blocks: CoreContentBlock[] = []

  for (const blockId of blockIds) {
    if (seen.has(blockId))
      continue
    seen.add(blockId)
    const block = index.getBlock(blockId)
    if (!block) {
      missing.push(blockId)
      continue
    }
    if (block.conceptId !== conceptId) {
      wrongConcept.push(blockId)
      continue
    }
    blocks.push(block)
  }

  if (missing.length > 0)
    throw new Error(`Unknown Core Content Block id(s): ${missing.join(', ')}`)
  if (wrongConcept.length > 0)
    throw new Error(`Core Content Block id(s) not linked to concept "${conceptId}": ${wrongConcept.join(', ')}`)

  return blocks
}

function sortByPackOrder(blocks: CoreContentBlock[]): CoreContentBlock[] {
  return [...blocks].sort((a, b) => a.order - b.order || a.blockId.localeCompare(b.blockId))
}
