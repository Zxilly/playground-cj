import { z } from 'zod'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import type { ClassroomSession } from '@/lib/ai/classroom/types'
import { instantiateExerciseTemplate } from '@/lib/ai/classroom/exercise-template-instantiation'
import {
  assertTemplateBackedByValidatedConcepts,
  planContentReferenceGroup,
  planSkipMarker,
  requireUsableCourseConcept,
} from '@/lib/ai/classroom/tutoring-step-planning'
import { getDefaultCourseContentIndex } from '@/lib/ai/course-content/loader'
import { resolveClarificationRetentionTarget } from './clarification-retention'
import { fail, ok } from './results'
import { requireClassroom } from './shared'
import type { LessonOrchestrationToolName } from './lesson-toolkit-metadata'

export interface LessonOrchestrationCommand {
  name: LessonOrchestrationToolName
  description: string
  parameters: z.ZodType
  execute: (bridge: AIClassroomBridgeValue, input: unknown) => Promise<unknown>
}

const appendContentReferenceGroupParameters = z.object({
  conceptId: z.string(),
  blockIds: z.array(z.string()).optional(),
  skillId: z.string().optional(),
  title: z.string().optional(),
})

const appendBridgeNoteParameters = z.object({
  conceptIds: z.array(z.string()).min(1),
  body: z.string().min(1).max(800),
})

const appendSkipMarkerParameters = z.object({
  conceptId: z.string(),
  blockIds: z.array(z.string()).min(1),
  reason: z.string().min(1).max(500),
})

const boundedPersonalizationList = z.array(z.string().min(1).max(160)).max(5)

const createExerciseInstanceParameters = z.object({
  templateId: z.string(),
  intent: z.union([z.literal('mainline'), z.literal('placement_check'), z.literal('review_check')]).optional(),
  personalizationInputs: z.object({
    conceptProgress: boundedPersonalizationList.optional(),
    recentErrorPatterns: boundedPersonalizationList.optional(),
    retainedRemediationSummaries: boundedPersonalizationList.optional(),
    declaredBackground: boundedPersonalizationList.optional(),
    difficultyTarget: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
    recentRelevantCodeSummaries: boundedPersonalizationList.optional(),
  }).strict().optional(),
}).strict()

const saveClarificationParameters = z.object({
  conceptId: z.string(),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(2000),
  summary: z.string().min(1).max(300),
})

const saveRemediationParameters = z.object({
  conceptId: z.string(),
  skillId: z.string().optional(),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(2000),
  summary: z.string().min(1).max(300),
  evidenceIds: z.array(z.string()).optional(),
})

export const LESSON_ORCHESTRATION_COMMANDS: readonly LessonOrchestrationCommand[] = [
  {
    name: 'append_content_reference_group',
    description: 'Append a Content Reference Group from validated Course Content. Provide a conceptId and optionally a subset of blockIds. The group preserves Course Content Pack order and never copies or rewrites Core Content.',
    parameters: appendContentReferenceGroupParameters,
    execute: appendContentReferenceGroup,
  },
  {
    name: 'append_bridge_note',
    description: 'Append a short learner-specific Bridge Note around Core Content. Use for path explanation or local connections; do not restate the full Core Content.',
    parameters: appendBridgeNoteParameters,
    execute: appendBridgeNote,
  },
  {
    name: 'append_skip_marker',
    description: 'Record that specific Core Content Blocks were intentionally skipped in Live View but remain available in Review View.',
    parameters: appendSkipMarkerParameters,
    execute: appendSkipMarker,
  },
  {
    name: 'create_exercise_instance',
    description: 'Create a learner Exercise Instance from an existing Exercise Template. Pass templateId, optional instance intent, and optional bounded personalizationInputs only; prompt, starter code, expected output, and match mode come from the validated template.',
    parameters: createExerciseInstanceParameters,
    execute: createExerciseInstance,
  },
  {
    name: 'save_clarification',
    description: 'Save a learner-specific Clarification as a Review Artifact. This keeps a concise personalized explanation without saving raw chat history.',
    parameters: saveClarificationParameters,
    execute: saveClarification,
  },
  {
    name: 'save_remediation',
    description: 'Save targeted Remediation Content after a real failed attempt. Link evidenceIds when available; do not create a new Core Content block.',
    parameters: saveRemediationParameters,
    execute: saveRemediation,
  },
]

function uiLang(bridge: AIClassroomBridgeValue): 'zh' | 'en' {
  return bridge.uiLang === 'en' ? 'en' : 'zh'
}

async function appendContentReferenceGroup(bridge: AIClassroomBridgeValue, input: unknown) {
  try {
    const { conceptId, blockIds, skillId, title } = appendContentReferenceGroupParameters.parse(input)
    const index = getDefaultCourseContentIndex()
    const planned = planContentReferenceGroup(index, { conceptId, blockIds, skillId })

    requireClassroom(bridge).dispatch({
      type: 'APPEND_CONTENT_REFERENCE_GROUP',
      conceptId: planned.conceptId,
      blockIds: planned.blockIds,
      skillId: planned.skillId,
      title,
      now: Date.now(),
    })
    return ok({ appended: planned.blockIds.length, blockIds: planned.blockIds })
  }
  catch (e) {
    return fail((e as Error).message)
  }
}

async function appendBridgeNote(bridge: AIClassroomBridgeValue, input: unknown) {
  try {
    const { conceptIds, body } = appendBridgeNoteParameters.parse(input)
    const index = getDefaultCourseContentIndex()
    for (const conceptId of conceptIds)
      requireUsableCourseConcept(index, conceptId, false)
    requireClassroom(bridge).dispatch({
      type: 'APPEND_BRIDGE_NOTE',
      conceptIds,
      body,
      now: Date.now(),
    })
    return ok()
  }
  catch (e) {
    return fail((e as Error).message)
  }
}

async function appendSkipMarker(bridge: AIClassroomBridgeValue, input: unknown) {
  try {
    const { conceptId, blockIds, reason } = appendSkipMarkerParameters.parse(input)
    const planned = planSkipMarker(getDefaultCourseContentIndex(), { conceptId, blockIds })
    requireClassroom(bridge).dispatch({
      type: 'APPEND_SKIP_MARKER',
      conceptId: planned.conceptId,
      blockIds: planned.blockIds,
      reason,
      now: Date.now(),
    })
    return ok()
  }
  catch (e) {
    return fail((e as Error).message)
  }
}

async function createExerciseInstance(bridge: AIClassroomBridgeValue, input: unknown) {
  try {
    const { templateId, intent, personalizationInputs } = createExerciseInstanceParameters.parse(input)
    const classroom = requireClassroom(bridge)
    const activeExercise = classroom.getSession().currentExercise
    if (activeExercise?.status === 'active') {
      return fail(
        `Cannot create a new Exercise Instance while exercise ${activeExercise.id} is active. Ask the learner to finish, submit, or skip the current exercise first.`,
      )
    }

    const index = getDefaultCourseContentIndex()
    const template = index.getExerciseTemplate(templateId)
    if (!template)
      return fail(`Unknown Exercise Template "${templateId}".`)
    assertTemplateBackedByValidatedConcepts(index, template)

    classroom.dispatch({
      type: 'CREATE_EXERCISE_INSTANCE',
      exercise: instantiateExerciseTemplate({
        template,
        lang: uiLang(bridge),
        intent,
        personalizationInputs,
      }),
      now: Date.now(),
    })
    return ok({ templateId, skillId: template.skillId, conceptIds: template.conceptIds, intent: intent ?? template.intent })
  }
  catch (e) {
    return fail((e as Error).message)
  }
}

async function saveClarification(bridge: AIClassroomBridgeValue, input: unknown) {
  try {
    const { conceptId, title, body, summary } = saveClarificationParameters.parse(input)
    const target = resolveClarificationRetentionTarget({
      conceptId,
      conceptStatuses: getDefaultCourseContentIndex().validation.conceptStatuses,
    })
    if (!target.ok)
      return fail(target.error)
    requireClassroom(bridge).dispatch({
      type: 'SAVE_REVIEW_ARTIFACT',
      artifact: {
        kind: target.artifactKind,
        conceptId: target.conceptId,
        title,
        body,
        summary,
        evidenceIds: [],
      },
      emitMarker: true,
      now: Date.now(),
    })
    return ok({
      retained: true,
      conceptId: target.conceptId,
      conceptStatus: target.conceptStatus,
      artifactKind: target.artifactKind,
      progressEffect: target.progressEffect,
    })
  }
  catch (e) {
    return fail((e as Error).message)
  }
}

async function saveRemediation(bridge: AIClassroomBridgeValue, input: unknown) {
  try {
    const { conceptId, skillId, title, body, summary, evidenceIds } = saveRemediationParameters.parse(input)
    requireUsableCourseConcept(getDefaultCourseContentIndex(), conceptId, true)
    const classroom = requireClassroom(bridge)
    const linkedEvidenceIds = resolveRemediationEvidenceIds(classroom.getSession(), {
      conceptId,
      skillId,
      evidenceIds,
    })
    if (evidenceIds && linkedEvidenceIds.length !== uniqueEvidenceIds(evidenceIds).length)
      return fail('Remediation evidenceIds must reference existing failure evidence for this concept or skill.')
    if (linkedEvidenceIds.length === 0)
      return fail('Remediation must link to existing failure evidence for this concept or skill.')
    classroom.dispatch({
      type: 'SAVE_REVIEW_ARTIFACT',
      artifact: {
        kind: 'remediation',
        conceptId,
        skillId,
        title,
        body,
        summary,
        evidenceIds: linkedEvidenceIds,
      },
      emitMarker: true,
      now: Date.now(),
    })
    return ok()
  }
  catch (e) {
    return fail((e as Error).message)
  }
}

function resolveRemediationEvidenceIds(
  session: ClassroomSession,
  {
    conceptId,
    skillId,
    evidenceIds,
  }: {
    conceptId: string
    skillId?: string
    evidenceIds?: string[]
  },
): string[] {
  const matchingEvidence = session.learner.evidence.filter(evidence =>
    evidence.outcome === 'failure'
    && evidence.conceptIds.includes(conceptId)
    && (skillId == null || evidence.skillId === skillId),
  )
  const matchingIds = new Set(matchingEvidence.map(evidence => evidence.evidenceId))

  if (evidenceIds && evidenceIds.length > 0)
    return uniqueEvidenceIds(evidenceIds).filter(id => matchingIds.has(id))

  const pendingFailure = session.eventQueue.find(event =>
    event.type === 'exercise_failure'
    && event.conceptIds.includes(conceptId)
    && (skillId == null || event.skillId === skillId),
  )
  const pendingFailureExerciseId = pendingFailure?.type === 'exercise_failure'
    ? pendingFailure.exerciseInstanceId
    : undefined
  const scopedEvidence = pendingFailure
    ? matchingEvidence.filter(evidence => evidence.exerciseInstanceId === pendingFailureExerciseId)
    : matchingEvidence

  return uniqueEvidenceIds(scopedEvidence
    .sort((a, b) => b.createdAt - a.createdAt || b.evidenceId.localeCompare(a.evidenceId))
    .map(evidence => evidence.evidenceId))
}

function uniqueEvidenceIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))]
}
