import type { Toolkit } from '@assistant-ui/react'
import { z } from 'zod'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import { deriveLessonOutline } from '@/lib/ai/classroom/selectors'
import { readClassroomCourseContent, readClassroomStateModel } from '@/lib/ai/classroom/read-models'
import { projectClassroomReviewView } from '@/lib/ai/classroom/view-projections'
import { readConcepts, readConceptsParameters } from './concepts'
import { fail, ok } from './results'
import { requireClassroom } from './shared'

const readLessonOutlineParameters = z.object({
  limit: z.number().int().min(1).max(20).optional(),
})

export function createChatClassroomStateTools(bridge: AIClassroomBridgeValue): Toolkit {
  return {
    read_classroom_state: {
      description: 'Read the current classroom state summary, phase, derived concept progress, learner evidence, and grouped retained review artifacts. Does not return the full stream or raw review artifact storage.',
      parameters: z.object({}),
      execute: async () => {
        try {
          const session = requireClassroom(bridge).getSession()
          return ok(readClassroomStateModel(session))
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    read_current_exercise: {
      description: 'Read the active Exercise Instance, if any. Use this to answer practice questions; do not complete or skip it.',
      parameters: z.object({}),
      execute: async () => {
        try {
          return ok({ currentExercise: requireClassroom(bridge).getSession().currentExercise })
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    read_last_run: {
      description: 'Read the latest deterministic runner result.',
      parameters: z.object({}),
      execute: async () => {
        try {
          return ok({ lastRun: requireClassroom(bridge).getSession().lastRun })
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    read_concepts: {
      description: 'Read Cangjie concept graph metadata and classroom concept status. Returns no references/provenance.',
      parameters: readConceptsParameters,
      execute: async ({ ids }) => {
        try {
          return ok({ concepts: readConcepts(bridge, ids) })
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    read_lesson_outline: {
      description: 'Read a bounded outline of Core Content references, recent stream items, active exercise, and concept progress. Does not return full Core Content text.',
      parameters: readLessonOutlineParameters,
      execute: async ({ limit }) => {
        try {
          return ok({ outline: deriveLessonOutline(requireClassroom(bridge).getSession(), limit) })
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    read_review_artifact_groups: {
      description: 'Read Review Artifact Groups for Review View. Clarifications are merged and Remediations are aggregated by evidence pattern; controls describe removable retained items without exposing raw storage.',
      parameters: z.object({
        conceptId: z.string().optional(),
      }),
      execute: async ({ conceptId }) => {
        try {
          const session = requireClassroom(bridge).getSession()
          const review = projectClassroomReviewView(session)
          const concepts = conceptId
            ? review.concepts.filter(concept => concept.conceptId === conceptId)
            : review.concepts
          return ok({ concepts: concepts.map(concept => ({
            conceptId: concept.conceptId,
            title: concept.title,
            artifactGroups: concept.artifactGroups,
            retainedItemControls: concept.retainedItemControls,
          })) })
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    read_course_content_pack: {
      description: 'Read Course Content Pack content for a target concept or skill. Read-only content may be returned for grounding chat answers; Exercise Templates are returned only for validated practice-ready concepts. Avoid reading the full pack unless explicitly needed.',
      parameters: z.object({
        conceptId: z.string().optional(),
        skillId: z.string().optional(),
      }),
      execute: async ({ conceptId, skillId }) => {
        try {
          const session = requireClassroom(bridge).getSession()
          return ok(readClassroomCourseContent(session, { conceptId, skillId }))
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },
  }
}

export function createLessonGenerationStateTools(bridge: AIClassroomBridgeValue): Toolkit {
  return {
    read_classroom_state: {
      description: 'Read the current classroom session summary, derived concept progress, learner evidence, and grouped retained review artifacts. Does not expose internal task/run identifiers or raw review artifact storage.',
      parameters: z.object({}),
      execute: async () => {
        try {
          const session = requireClassroom(bridge).getSession()
          return ok(readClassroomStateModel(session, {
            includeLastRun: true,
            includeQueuedEvents: true,
            includeContentPack: true,
          }))
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    read_concepts: {
      description: 'Read Cangjie concept graph metadata and classroom concept status. Returns no references/provenance.',
      parameters: readConceptsParameters,
      execute: async ({ ids }) => {
        try {
          return ok({ concepts: readConcepts(bridge, ids) })
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    read_lesson_outline: {
      description: 'Read a bounded outline of Core Content references, recent stream items, active exercise, and concept progress. Does not return full Core Content text.',
      parameters: readLessonOutlineParameters,
      execute: async ({ limit }) => {
        try {
          return ok({ outline: deriveLessonOutline(requireClassroom(bridge).getSession(), limit) })
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    read_review_artifact_groups: {
      description: 'Read Review Artifact Groups for lesson decisions. Clarifications are merged and Remediations are aggregated by evidence pattern; controls describe removable retained items without exposing raw storage.',
      parameters: z.object({
        conceptId: z.string().optional(),
      }),
      execute: async ({ conceptId }) => {
        try {
          const session = requireClassroom(bridge).getSession()
          const review = projectClassroomReviewView(session)
          const concepts = conceptId
            ? review.concepts.filter(concept => concept.conceptId === conceptId)
            : review.concepts
          return ok({ concepts: concepts.map(concept => ({
            conceptId: concept.conceptId,
            title: concept.title,
            artifactGroups: concept.artifactGroups,
            retainedItemControls: concept.retainedItemControls,
          })) })
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    read_course_content_pack: {
      description: 'Read Course Content Pack metadata. Use this before selecting concept blockIds or Exercise Templates; Exercise Templates are returned only for validated practice-ready concepts.',
      parameters: z.object({
        conceptId: z.string().optional(),
        skillId: z.string().optional(),
      }),
      execute: async ({ conceptId, skillId }) => {
        try {
          const session = requireClassroom(bridge).getSession()
          return ok(readClassroomCourseContent(session, { conceptId, skillId }))
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },
  }
}
