import { courseContentPackSchema } from './schema'
import type {
  ConceptValidationStatus,
  ContentPackValidationIssue,
  ContentPackValidationResult,
  CourseContentPack,
} from './types'
import { getConcept } from '@/lib/ai/concept-graph/loader'

function pushIssue(issues: ContentPackValidationIssue[], path: string, message: string) {
  issues.push({ path, message })
}

function recordDuplicate(
  issues: ContentPackValidationIssue[],
  seen: Set<string>,
  value: string,
  path: string,
) {
  if (seen.has(value))
    pushIssue(issues, path, `Duplicate id "${value}"`)
  seen.add(value)
}

function allReferencedConceptsExist(pack: CourseContentPack, issues: ContentPackValidationIssue[]) {
  const conceptIds = new Set(pack.concepts.map(c => c.conceptId))
  for (const [index, concept] of pack.concepts.entries()) {
    if (!getConcept(concept.conceptId))
      pushIssue(issues, `concepts.${index}.conceptId`, `Unknown concept graph id "${concept.conceptId}"`)
  }
  for (const [index, skill] of pack.skills.entries()) {
    for (const conceptId of skill.conceptIds) {
      if (!conceptIds.has(conceptId))
        pushIssue(issues, `skills.${index}.conceptIds`, `Unknown concept "${conceptId}"`)
    }
  }
  for (const [index, template] of pack.exerciseTemplates.entries()) {
    for (const conceptId of template.conceptIds) {
      if (!conceptIds.has(conceptId))
        pushIssue(issues, `exerciseTemplates.${index}.conceptIds`, `Unknown concept "${conceptId}"`)
    }
  }
  for (const [index, track] of pack.tracks.entries()) {
    for (const conceptId of track.conceptIds) {
      if (!conceptIds.has(conceptId))
        pushIssue(issues, `tracks.${index}.conceptIds`, `Unknown concept "${conceptId}"`)
    }
    for (const skillId of track.skillIds) {
      if (!pack.skills.some(skill => skill.skillId === skillId))
        pushIssue(issues, `tracks.${index}.skillIds`, `Unknown skill "${skillId}"`)
    }
  }
}

function validateSourceReferences(pack: CourseContentPack, issues: ContentPackValidationIssue[]) {
  for (const [blockIndex, block] of pack.blocks.entries()) {
    for (const [refIndex, ref] of block.sourceRefs.entries()) {
      if (!ref.tourPath.includes(ref.chapterId))
        pushIssue(issues, `blocks.${blockIndex}.sourceRefs.${refIndex}.chapterId`, `Source Reference chapter "${ref.chapterId}" is not present in "${ref.tourPath}"`)
      if (ref.subChapterId && !ref.tourPath.includes(ref.subChapterId))
        pushIssue(issues, `blocks.${blockIndex}.sourceRefs.${refIndex}.subChapterId`, `Source Reference subchapter "${ref.subChapterId}" is not present in "${ref.tourPath}"`)
      if (ref.sectionId && !ref.tourPath.includes(ref.sectionId))
        pushIssue(issues, `blocks.${blockIndex}.sourceRefs.${refIndex}.sectionId`, `Source Reference section "${ref.sectionId}" is not present in "${ref.tourPath}"`)
    }
    if (block.contentVersion !== pack.contentVersion)
      pushIssue(issues, `blocks.${blockIndex}.contentVersion`, `Block "${block.blockId}" contentVersion must match pack contentVersion "${pack.contentVersion}"`)
  }

  for (const [templateIndex, template] of pack.exerciseTemplates.entries()) {
    for (const [refIndex, ref] of template.sourceRefs.entries()) {
      if (!ref.tourPath.includes(ref.chapterId))
        pushIssue(issues, `exerciseTemplates.${templateIndex}.sourceRefs.${refIndex}.chapterId`, `Source Reference chapter "${ref.chapterId}" is not present in "${ref.tourPath}"`)
    }
  }
}

function validateRunnableMarkers(pack: CourseContentPack, issues: ContentPackValidationIssue[]) {
  for (const [index, block] of pack.blocks.entries()) {
    if (block.content.type !== 'code_example')
      continue
    if (!block.runnable) {
      pushIssue(issues, `blocks.${index}.runnable`, `Code example "${block.blockId}" must declare runnable status`)
      continue
    }
    if (block.runnable.status === 'not_runnable' && !block.runnable.reason)
      pushIssue(issues, `blocks.${index}.runnable.reason`, `Non-runnable code example "${block.blockId}" needs a reason`)
  }
}

function validateConceptLinks(pack: CourseContentPack, issues: ContentPackValidationIssue[]) {
  const blockIds = new Set(pack.blocks.map(block => block.blockId))
  const skillIds = new Set(pack.skills.map(skill => skill.skillId))

  for (const [index, concept] of pack.concepts.entries()) {
    for (const blockId of concept.blockIds) {
      if (!blockIds.has(blockId))
        pushIssue(issues, `concepts.${index}.blockIds`, `Unknown block "${blockId}"`)
    }
    for (const skillId of concept.skillIds) {
      if (!skillIds.has(skillId))
        pushIssue(issues, `concepts.${index}.skillIds`, `Unknown skill "${skillId}"`)
    }
  }

  for (const [index, block] of pack.blocks.entries()) {
    const owner = pack.concepts.find(concept => concept.conceptId === block.conceptId)
    if (!owner) {
      pushIssue(issues, `blocks.${index}.conceptId`, `Unknown concept "${block.conceptId}"`)
      continue
    }
    if (!owner.blockIds.includes(block.blockId))
      pushIssue(issues, `blocks.${index}.blockId`, `Block "${block.blockId}" is not listed by concept "${block.conceptId}"`)
  }

  for (const [index, skill] of pack.skills.entries()) {
    for (const conceptId of skill.conceptIds) {
      const owner = pack.concepts.find(concept => concept.conceptId === conceptId)
      if (owner && !owner.skillIds.includes(skill.skillId))
        pushIssue(issues, `skills.${index}.skillId`, `Skill "${skill.skillId}" is not listed by concept "${conceptId}"`)
    }
  }

  for (const [index, template] of pack.exerciseTemplates.entries()) {
    if (!skillIds.has(template.skillId))
      pushIssue(issues, `exerciseTemplates.${index}.skillId`, `Unknown skill "${template.skillId}"`)
    const owner = pack.skills.find(skill => skill.skillId === template.skillId)
    if (owner) {
      for (const conceptId of template.conceptIds) {
        if (!owner.conceptIds.includes(conceptId))
          pushIssue(issues, `exerciseTemplates.${index}.conceptIds`, `Template "${template.templateId}" references concept "${conceptId}" outside skill "${template.skillId}"`)
      }
    }
  }
}

function validateBlockOrdering(pack: CourseContentPack, issues: ContentPackValidationIssue[]) {
  for (const concept of pack.concepts) {
    const seenOrders = new Set<number>()
    const conceptBlocks = pack.blocks.filter(block => block.conceptId === concept.conceptId)
    for (const block of conceptBlocks) {
      if (seenOrders.has(block.order))
        pushIssue(issues, `blocks.${pack.blocks.indexOf(block)}.order`, `Duplicate order ${block.order} for concept "${concept.conceptId}"`)
      seenOrders.add(block.order)
    }
  }
}

function deriveConceptStatuses(pack: CourseContentPack, issues: ContentPackValidationIssue[]): Record<string, ConceptValidationStatus> {
  const blockIds = new Set(pack.blocks.map(block => block.blockId))
  const skillIds = new Set(pack.skills.map(skill => skill.skillId))
  const templateSkillIds = new Set(pack.exerciseTemplates.map(template => template.skillId))
  const statuses: Record<string, ConceptValidationStatus> = {}

  for (const concept of pack.concepts) {
    const conceptHasIssue = issues.some((issue) => {
      if (issue.message.includes(`"${concept.conceptId}"`))
        return true
      return pack.blocks.some(block => block.conceptId === concept.conceptId && issue.message.includes(`"${block.blockId}"`))
        || pack.skills.some(skill => skill.conceptIds.includes(concept.conceptId) && issue.message.includes(`"${skill.skillId}"`))
    })
    const hasAllBlocks = concept.blockIds.length > 0 && concept.blockIds.every(blockId => blockIds.has(blockId))
    const hasSkills = concept.skillIds.length > 0 && concept.skillIds.every(skillId => skillIds.has(skillId))
    const hasTemplates = concept.skillIds.length > 0 && concept.skillIds.every(skillId => templateSkillIds.has(skillId))

    if (!hasAllBlocks || conceptHasIssue) {
      statuses[concept.conceptId] = 'invalid'
    }
    else if (hasSkills && hasTemplates) {
      statuses[concept.conceptId] = 'validated'
    }
    else {
      statuses[concept.conceptId] = 'read_only'
    }
  }

  return statuses
}

export function validateCourseContentPack(input: unknown): ContentPackValidationResult {
  const parsed = courseContentPackSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
      conceptStatuses: {},
    }
  }

  const pack = parsed.data
  const issues: ContentPackValidationIssue[] = []
  const conceptIds = new Set<string>()
  const blockIds = new Set<string>()
  const skillIds = new Set<string>()
  const templateIds = new Set<string>()
  const trackIds = new Set<string>()

  for (const [index, concept] of pack.concepts.entries())
    recordDuplicate(issues, conceptIds, concept.conceptId, `concepts.${index}.conceptId`)
  for (const [index, block] of pack.blocks.entries())
    recordDuplicate(issues, blockIds, block.blockId, `blocks.${index}.blockId`)
  for (const [index, skill] of pack.skills.entries())
    recordDuplicate(issues, skillIds, skill.skillId, `skills.${index}.skillId`)
  for (const [index, template] of pack.exerciseTemplates.entries())
    recordDuplicate(issues, templateIds, template.templateId, `exerciseTemplates.${index}.templateId`)
  for (const [index, track] of pack.tracks.entries())
    recordDuplicate(issues, trackIds, track.trackId, `tracks.${index}.trackId`)

  allReferencedConceptsExist(pack, issues)
  validateConceptLinks(pack, issues)
  validateBlockOrdering(pack, issues)
  validateRunnableMarkers(pack, issues)
  validateSourceReferences(pack, issues)

  return {
    ok: issues.length === 0,
    issues,
    conceptStatuses: deriveConceptStatuses(pack, issues),
  }
}

export function assertValidCourseContentPack<T extends CourseContentPack>(pack: T): T {
  const result = validateCourseContentPack(pack)
  if (!result.ok) {
    const details = result.issues.map(issue => `${issue.path}: ${issue.message}`).join('\n')
    throw new Error(`Invalid Course Content Pack:\n${details}`)
  }
  return pack
}
