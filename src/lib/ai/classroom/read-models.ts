import type { ConceptValidationStatus, CoreContentBlock, CourseConcept, CourseContentBlockContent, ExerciseTemplate, LearningSkill } from '@/lib/ai/course-content/types'
import type { ConceptNode } from '@/lib/ai/concept-graph/types'
import type { ClassroomSession, ConceptStatus, LearningEvidence, ReviewExposure, ReviewExposureStatus } from './types'
import { deriveSessionPendingWork } from './selectors'
import {
  deriveConceptProgress,
  deriveConceptProgressEntries,
  deriveDemonstratedConceptSet,
  deriveSkippedConceptCounts,
  readinessForStatus,
} from './concept-progress'
import type { ConceptReadiness } from './concept-progress'
import { groupActiveReviewArtifactsByConcept } from './review-artifacts'
import type { ConceptReviewArtifactGroup } from './review-artifacts'
import { getAllConcepts, getReadyConcepts } from '@/lib/ai/concept-graph/loader'
import { getDefaultCourseContentIndex, getLocalizedBlockContent } from '@/lib/ai/course-content/loader'

interface ClassroomStateReadModelOptions {
  includeLastRun?: boolean
  includeQueuedEvents?: boolean
  includeContentPack?: boolean
}

export interface ClassroomStateReadModel {
  phase: ClassroomSession['phase']
  pendingAction: ReturnType<typeof deriveSessionPendingWork>
  sessionSummary: string
  learner: ClassroomLearnerReadModel
  conceptProgress: ReturnType<typeof deriveConceptProgress>
  conceptProgressDetails: ReturnType<typeof deriveConceptProgressEntries>
  currentExercise: ClassroomSession['currentExercise']
  lastRun?: ClassroomSession['lastRun']
  queuedEvents?: ClassroomSession['eventQueue']
  contentPack?: {
    packId: string
    contentVersion: string
    activeTrackId: string
  }
}

export interface ClassroomLearnerReadModel {
  evidence: LearningEvidence[]
  reviewExposures: ReviewExposure[]
  reviewArtifactGroups: ConceptReviewArtifactGroup[]
}

export interface ClassroomCourseContentQuery {
  conceptId?: string
  skillId?: string
}

export interface ClassroomContentBlockReadModel extends Omit<CoreContentBlock, 'content' | 'localizedContent'> {
  content: CourseContentBlockContent
}

export interface ClassroomCourseContentReadModel {
  packId: string
  contentVersion: string
  validation: ReturnType<typeof getDefaultCourseContentIndex>['validation']
  track: ReturnType<typeof getDefaultCourseContentIndex>['pack']['tracks'][number] | undefined
  concepts: CourseConcept[]
  blocks: ClassroomContentBlockReadModel[]
  skills: LearningSkill[]
  exerciseTemplates: ReturnType<typeof getDefaultCourseContentIndex>['pack']['exerciseTemplates']
}

export interface ClassroomConceptReadModel {
  conceptId: string
  contentStatus: ConceptValidationStatus | 'unavailable'
  title: string
  summary: string
  difficulty: ConceptNode['difficulty']
  prerequisites: ConceptNode['prerequisites']
  status: ConceptStatus
  exposure: ReviewExposureStatus | 'none'
  readiness: ConceptReadiness
  blockerExplanation: string | null
  skipCount: number
}

export function readClassroomStateModel(
  session: ClassroomSession,
  options: ClassroomStateReadModelOptions = {},
): ClassroomStateReadModel {
  const conceptProgressDetails = deriveConceptProgressEntries(session)
  const conceptOrder = new Map(conceptProgressDetails.map((entry, index) => [entry.conceptId, index]))
  const reviewArtifactGroups = [...groupActiveReviewArtifactsByConcept(
    session.learner.reviewArtifacts,
    session.learner.evidence,
  ).values()].sort((a, b) => compareReadModelConceptIds(a.conceptId, b.conceptId, conceptOrder))

  return {
    phase: session.phase,
    pendingAction: deriveSessionPendingWork(session),
    sessionSummary: session.sessionSummary,
    learner: {
      evidence: session.learner.evidence,
      reviewExposures: Object.values(session.learner.reviewExposures)
        .sort((a, b) => compareReadModelConceptIds(a.conceptId, b.conceptId, conceptOrder) || a.blockId.localeCompare(b.blockId)),
      reviewArtifactGroups,
    },
    conceptProgress: deriveConceptProgress(session),
    conceptProgressDetails,
    currentExercise: session.currentExercise,
    ...(options.includeLastRun ? { lastRun: session.lastRun } : {}),
    ...(options.includeQueuedEvents ? { queuedEvents: session.eventQueue } : {}),
    ...(options.includeContentPack
      ? {
          contentPack: {
            packId: session.contentPackId,
            contentVersion: session.contentVersion,
            activeTrackId: session.track.activeTrackId,
          },
        }
      : {}),
  }
}

function compareReadModelConceptIds(
  a: string,
  b: string,
  conceptOrder: ReadonlyMap<string, number>,
): number {
  return (conceptOrder.get(a) ?? Number.MAX_SAFE_INTEGER) - (conceptOrder.get(b) ?? Number.MAX_SAFE_INTEGER)
    || a.localeCompare(b)
}

function activeTrack(session: ClassroomSession): ClassroomCourseContentReadModel['track'] {
  const index = getDefaultCourseContentIndex()
  return index.pack.tracks.find(track => track.trackId === session.track.activeTrackId) ?? index.pack.tracks[0]
}

function localizedBlock(block: CoreContentBlock, lang: string): ClassroomContentBlockReadModel {
  const { localizedContent: _localizedContent, ...rest } = block
  return {
    ...rest,
    content: getLocalizedBlockContent(block, lang),
  }
}

export function readClassroomCourseContent(
  session: ClassroomSession,
  query: ClassroomCourseContentQuery = {},
): ClassroomCourseContentReadModel {
  const index = getDefaultCourseContentIndex()
  const { conceptId, skillId } = query
  const skills = conceptId
    ? index.getSkillsForConcept(conceptId)
    : skillId ? [index.getSkill(skillId)].filter(skill => skill != null) : index.pack.skills
  const templateMap = new Map(
    (skillId
      ? index.getExerciseTemplatesForSkill(skillId)
      : conceptId
        ? skills.flatMap(skill => index.getExerciseTemplatesForSkill(skill.skillId))
        : []
    ).map(template => [template.templateId, template]),
  )
  const exerciseTemplates = Array.from(templateMap.values())
    .filter(template => isPracticeTemplateVisible(index, template))

  return {
    packId: index.pack.packId,
    contentVersion: index.pack.contentVersion,
    validation: index.validation,
    track: activeTrack(session),
    concepts: conceptId ? [index.getConcept(conceptId)].filter(concept => concept != null) : index.pack.concepts,
    blocks: conceptId ? index.getBlocksForConcept(conceptId).map(block => localizedBlock(block, session.lang)) : [],
    skills,
    exerciseTemplates,
  }
}

function isPracticeTemplateVisible(
  index: ReturnType<typeof getDefaultCourseContentIndex>,
  template: ExerciseTemplate,
): boolean {
  if (!index.getSkill(template.skillId))
    return false
  if (!template.conceptIds.every(conceptId => index.validation.conceptStatuses[conceptId] === 'validated'))
    return false
  return template.conceptIds.some(conceptId =>
    index.getSkillsForConcept(conceptId).some(skill => skill.skillId === template.skillId),
  )
}

export function readClassroomConcepts(
  session: ClassroomSession,
  lang: string,
  ids?: string[],
): ClassroomConceptReadModel[] {
  const concepts = getAllConcepts()
  const index = getDefaultCourseContentIndex()
  const skipCounts = deriveSkippedConceptCounts(session)
  const progressEntries = new Map(deriveConceptProgressEntries(session).map(entry => [entry.conceptId, entry]))
  const selected = ids && ids.length > 0
    ? concepts.filter(concept => ids.includes(concept.conceptId))
    : [...getReadyConcepts(deriveDemonstratedConceptSet(session))]
        .sort((a, b) => {
          const skipDelta = (skipCounts.get(a.conceptId) ?? 0) - (skipCounts.get(b.conceptId) ?? 0)
          if (skipDelta !== 0)
            return skipDelta
          return a.difficulty - b.difficulty
        })
        .slice(0, 20)

  return selected.map((concept) => {
    const progress = progressEntries.get(concept.conceptId)
    const contentStatus = progress?.contentStatus ?? index.validation.conceptStatuses[concept.conceptId] ?? 'unavailable'
    return {
      conceptId: concept.conceptId,
      contentStatus,
      title: concept.title[lang === 'en' ? 'en' : 'zh'],
      summary: concept.summary[lang === 'en' ? 'en' : 'zh'],
      difficulty: concept.difficulty,
      prerequisites: concept.prerequisites,
      status: progress?.status ?? 'unseen',
      exposure: progress?.exposure ?? 'none',
      readiness: progress?.readiness ?? readinessForStatus('unseen', contentStatus),
      blockerExplanation: progress?.blockerExplanation ?? null,
      skipCount: skipCounts.get(concept.conceptId) ?? 0,
    }
  })
}
