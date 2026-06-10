import type { ConceptValidationStatus, CoreContentBlock, CourseContentBlockContent } from '@/lib/ai/course-content/types'
import type { ClassroomSession, ClassroomStreamItem, ContentReference, ReviewExposure, ReviewExposureStatus, RunResult } from './types'
import { getDefaultCourseContentIndex, getLocalizedBlockContent } from '@/lib/ai/course-content/loader'
import { groupActiveReviewArtifactsByConcept } from './review-artifacts'
import type { ConceptReviewArtifactGroup, RetainedItemControlState, ReviewArtifactGroup } from './review-artifacts'
import { deriveConceptProgressEntries, readinessForStatus, statusForConcept } from './concept-progress'
import type { ConceptProgressEntry } from './concept-progress'

type ClassroomStream = ClassroomSession['stream']

export interface ClassroomResolvedContentBlock {
  reference: ContentReference
  blockId: string
  blockIndex: number
  blockKey: string
  conceptId: string
  encounteredContentVersion: string
  currentContentVersion: string
  versionMismatch: boolean
  order: number
  content: CourseContentBlockContent
  sourceRefs: CoreContentBlock['sourceRefs']
  runnable?: CoreContentBlock['runnable']
}

export interface ClassroomLiveViewItem {
  id: string
  type: ClassroomStreamItem['type']
  source: ClassroomStreamItem
  visible: boolean
  visibleIndex: number | null
  resolvedBlocks: ClassroomResolvedContentBlock[]
  heading: string | null
}

export interface ClassroomLiveView {
  items: ClassroomLiveViewItem[]
  visibleItems: ClassroomLiveViewItem[]
  latestRunByExercise: ReadonlyMap<string, RunResult>
}

export interface ClassroomLiveViewBlockTarget {
  blockKey: string
  blockIndex: number
  streamItemId: string
  visibleIndex: number
}

export interface ClassroomLiveViewExerciseTarget {
  exerciseId: string
  streamItemId: string
  visibleIndex: number
}

export interface ClassroomChapterIndexEntry {
  id: string
  text: string
  level: 2 | 3
  streamItemId: string
  blockKey: string
}

export interface ClassroomLiveViewSurface {
  liveView: ClassroomLiveView
  items: ClassroomLiveViewItem[]
  visibleItems: ClassroomLiveViewItem[]
  visibleCount: number
  latestRunByExercise: ReadonlyMap<string, RunResult>
  chapterEntries: ClassroomChapterIndexEntry[]
  blockTargetsByKey: ReadonlyMap<string, ClassroomLiveViewBlockTarget>
  exerciseTargetsById: ReadonlyMap<string, ClassroomLiveViewExerciseTarget>
}

export interface ClassroomReviewBlock {
  blockId: string
  blockIndex: number
  blockKey: string
  conceptId: string
  order: number
  contentVersion: string
  exposure: ReviewExposure | null
  exposureStatus: ReviewExposureStatus
  versionMismatch: boolean
  content: CourseContentBlockContent
  sourceRefs: CoreContentBlock['sourceRefs']
  runnable?: CoreContentBlock['runnable']
}

export interface ClassroomReviewConcept {
  conceptId: string
  contentStatus: ConceptValidationStatus
  title: string
  summary: string
  blockIds: string[]
  skillIds: string[]
  progress: ConceptProgressEntry
  exposureStatus: ReviewExposureStatus
  blocks: ClassroomReviewBlock[]
  artifactGroups: ReviewArtifactGroup[]
  retainedItemControls: RetainedItemControlState[]
}

export interface ClassroomReviewView {
  packId: string
  contentVersion: string
  activeTrackId: string
  trackTitle: string
  defaultConceptId: string | null
  concepts: ClassroomReviewConcept[]
}

export function lessonBlockDomId(streamItemId: string, blockIndex: number): string {
  return `${streamItemId}:block:${blockIndex}`
}

function localizedText(text: { zh: string, en: string }, lang: string): string {
  return lang === 'en' ? text.en : text.zh
}

function resolveReference(
  ref: ContentReference,
  blockIndex: number,
  streamItemId: string,
  lang: string,
): ClassroomResolvedContentBlock | null {
  const block = getDefaultCourseContentIndex().getBlock(ref.blockId)
  if (!block)
    return null

  return {
    reference: ref,
    blockId: block.blockId,
    blockIndex,
    blockKey: lessonBlockDomId(streamItemId, blockIndex),
    conceptId: block.conceptId,
    encounteredContentVersion: ref.contentVersion,
    currentContentVersion: block.contentVersion,
    versionMismatch: ref.contentVersion !== block.contentVersion,
    order: block.order,
    content: getLocalizedBlockContent(block, lang),
    sourceRefs: block.sourceRefs,
    runnable: block.runnable,
  }
}

function headingForContentReferenceGroup(
  item: Extract<ClassroomStreamItem, { type: 'content_reference_group' }>,
  blocks: ClassroomResolvedContentBlock[],
  lang: string,
): string | null {
  if (item.title)
    return item.title

  const heading = blocks.find(block => block.content.type === 'heading')
  if (heading?.content.type === 'heading')
    return heading.content.text

  const concept = getDefaultCourseContentIndex().getConcept(item.conceptId)
  return concept ? localizedText(concept.title, lang) : item.conceptId
}

export function projectClassroomLiveView(session: ClassroomSession): ClassroomLiveView {
  const latestRunByExercise = new Map<string, RunResult>()
  let visibleIndex = 0

  const items = session.stream.map((source): ClassroomLiveViewItem => {
    if (source.type === 'run_result' && source.exerciseInstanceId)
      latestRunByExercise.set(source.exerciseInstanceId, source.result)

    const visible = source.type !== 'run_result'
    const resolvedBlocks = source.type === 'content_reference_group'
      ? source.references
          .map((ref, blockIndex) => resolveReference(ref, blockIndex, source.id, session.lang))
          .filter(block => block != null)
      : []
    const heading = source.type === 'content_reference_group'
      ? headingForContentReferenceGroup(source, resolvedBlocks, session.lang)
      : null
    const itemVisibleIndex = visible ? visibleIndex++ : null

    return {
      id: source.id,
      type: source.type,
      source,
      visible,
      visibleIndex: itemVisibleIndex,
      resolvedBlocks,
      heading,
    }
  })

  return {
    items,
    visibleItems: items.filter(item => item.visible),
    latestRunByExercise,
  }
}

export function visibleClassroomStream(session: ClassroomSession): ClassroomStreamItem[] {
  return projectClassroomLiveView(session).visibleItems.map(item => item.source)
}

export function projectClassroomLiveViewSurface(session: ClassroomSession): ClassroomLiveViewSurface {
  return createClassroomLiveViewSurface(projectClassroomLiveView(session))
}

export function createClassroomLiveViewSurface(liveView: ClassroomLiveView): ClassroomLiveViewSurface {
  const blockTargetsByKey = new Map<string, ClassroomLiveViewBlockTarget>()
  const exerciseTargetsById = new Map<string, ClassroomLiveViewExerciseTarget>()
  for (const item of liveView.visibleItems) {
    if (item.visibleIndex == null)
      continue

    if (item.source.type === 'content_reference_group') {
      for (const block of item.resolvedBlocks) {
        blockTargetsByKey.set(block.blockKey, {
          blockKey: block.blockKey,
          blockIndex: block.blockIndex,
          streamItemId: item.id,
          visibleIndex: item.visibleIndex,
        })
      }
    }

    if (item.source.type === 'exercise_instance') {
      exerciseTargetsById.set(item.source.exercise.id, {
        exerciseId: item.source.exercise.id,
        streamItemId: item.id,
        visibleIndex: item.visibleIndex,
      })
    }
  }

  return {
    liveView,
    items: liveView.items,
    visibleItems: liveView.visibleItems,
    visibleCount: liveView.visibleItems.length,
    latestRunByExercise: liveView.latestRunByExercise,
    chapterEntries: deriveLiveViewChapterIndex(liveView),
    blockTargetsByKey,
    exerciseTargetsById,
  }
}

export function deriveLiveViewChapterIndex(liveView: ClassroomLiveView): ClassroomChapterIndexEntry[] {
  const out: ClassroomChapterIndexEntry[] = []
  for (const item of liveView.visibleItems) {
    if (item.source.type !== 'content_reference_group')
      continue

    for (const block of item.resolvedBlocks) {
      if (block.content.type !== 'heading')
        continue
      out.push({
        id: `${item.id}:${block.blockIndex}:${block.blockKey}`,
        text: block.content.text,
        level: block.content.level ?? 2,
        streamItemId: item.id,
        blockKey: block.blockKey,
      })
    }
  }
  return out
}

export function latestLiveViewHeading(liveView: ClassroomLiveView): string | null {
  for (let i = liveView.items.length - 1; i >= 0; i--) {
    const item = liveView.items[i]
    if (item.source.type === 'content_reference_group')
      return item.heading
  }
  return null
}

function exposureStatusForBlocks(blocks: ClassroomReviewBlock[]): ReviewExposureStatus {
  if (blocks.some(block => block.exposureStatus === 'seen'))
    return 'seen'
  if (blocks.some(block => block.exposureStatus === 'skipped'))
    return 'skipped'
  return 'unseen'
}

function reviewBlockForCoreContent(
  block: CoreContentBlock,
  blockIndex: number,
  session: ClassroomSession,
  lang: string,
): ClassroomReviewBlock {
  const exposure = session.learner.reviewExposures[block.blockId] ?? null

  return {
    blockId: block.blockId,
    blockIndex,
    blockKey: lessonBlockDomId(`review:${block.conceptId}`, blockIndex),
    conceptId: block.conceptId,
    order: block.order,
    contentVersion: block.contentVersion,
    exposure,
    exposureStatus: exposure?.status ?? 'unseen',
    versionMismatch: exposure ? exposure.contentVersion !== block.contentVersion : false,
    content: getLocalizedBlockContent(block, lang),
    sourceRefs: block.sourceRefs,
    runnable: block.runnable,
  }
}

export function projectClassroomReviewView(session: ClassroomSession, lang = session.lang): ClassroomReviewView {
  const index = getDefaultCourseContentIndex()
  const track = index.pack.tracks.find(t => t.trackId === session.track.activeTrackId) ?? index.pack.tracks[0]
  const artifactGroups = groupActiveReviewArtifactsByConcept(session.learner.reviewArtifacts, session.learner.evidence)
  const progressByConceptId = new Map(deriveConceptProgressEntries(session).map(entry => [entry.conceptId, entry]))
  const concepts = (track?.conceptIds ?? index.pack.concepts.map(concept => concept.conceptId))
    .map(conceptId => index.getConcept(conceptId))
    .filter(concept => concept != null)
    .map((concept): ClassroomReviewConcept => {
      const blocks = index.getBlocksForConcept(concept.conceptId)
        .map((block, blockIndex) => reviewBlockForCoreContent(block, blockIndex, session, lang))
      const exposureStatus = exposureStatusForBlocks(blocks)
      const fallbackStatus = statusForConcept([], exposureStatus)
      const contentStatus = index.validation.conceptStatuses[concept.conceptId] ?? 'invalid'
      const groupedArtifacts: ConceptReviewArtifactGroup = artifactGroups.get(concept.conceptId) ?? {
        conceptId: concept.conceptId,
        clarifications: [],
        remediations: [],
        controls: [],
      }

      return {
        conceptId: concept.conceptId,
        contentStatus,
        title: localizedText(concept.title, lang),
        summary: localizedText(concept.summary, lang),
        blockIds: concept.blockIds,
        skillIds: concept.skillIds,
        progress: progressByConceptId.get(concept.conceptId) ?? {
          conceptId: concept.conceptId,
          status: fallbackStatus,
          contentStatus,
          evidence: [],
          exposure: exposureStatus,
          readiness: readinessForStatus(fallbackStatus, contentStatus),
          blockerExplanation: null,
        },
        exposureStatus,
        blocks,
        artifactGroups: [...groupedArtifacts.clarifications, ...groupedArtifacts.remediations],
        retainedItemControls: groupedArtifacts.controls,
      }
    })

  return {
    packId: index.pack.packId,
    contentVersion: index.pack.contentVersion,
    activeTrackId: track?.trackId ?? session.track.activeTrackId,
    trackTitle: track ? localizedText(track.title, lang) : session.track.activeTrackId,
    defaultConceptId: concepts[0]?.conceptId ?? null,
    concepts,
  }
}

export function streamFromLiveView(liveView: ClassroomLiveView): ClassroomStream {
  return liveView.items.map(item => item.source)
}
