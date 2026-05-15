import type { Toolkit } from '@assistant-ui/react'
import { z } from 'zod'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import { deriveConceptProgress, deriveLessonOutline, deriveSessionPendingWork } from '@/lib/ai/classroom/selectors'
import { readConcepts, readConceptsParameters } from './concepts'
import { fail, ok } from './results'
import { requireClassroom } from './shared'

const readLessonOutlineParameters = z.object({
  limit: z.number().int().min(1).max(20).optional(),
})

export function createChatClassroomStateTools(bridge: AIClassroomBridgeValue): Toolkit {
  return {
    read_classroom_state: {
      description: 'Read the current classroom state summary, phase, learner evidence, and pending action. Does not return the full stream.',
      parameters: z.object({}),
      execute: async () => {
        try {
          const session = requireClassroom(bridge).getSession()
          return ok({
            phase: session.phase,
            pendingAction: deriveSessionPendingWork(session),
            sessionSummary: session.sessionSummary,
            learner: session.learner,
            conceptProgress: deriveConceptProgress(session),
            currentQuiz: session.currentQuiz,
          })
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    read_current_quiz: {
      description: 'Read the active quiz, if any. Use this to answer quiz questions; do not complete or skip it.',
      parameters: z.object({}),
      execute: async () => {
        try {
          return ok({ currentQuiz: requireClassroom(bridge).getSession().currentQuiz })
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
  }
}

export function createLessonGenerationStateTools(bridge: AIClassroomBridgeValue): Toolkit {
  return {
    read_classroom_state: {
      description: 'Read the current classroom session summary and learner state. Does not expose internal task/run identifiers.',
      parameters: z.object({}),
      execute: async () => {
        try {
          const session = requireClassroom(bridge).getSession()
          return ok({
            phase: session.phase,
            pendingAction: deriveSessionPendingWork(session),
            sessionSummary: session.sessionSummary,
            learner: session.learner,
            conceptProgress: deriveConceptProgress(session),
            currentQuiz: session.currentQuiz,
            lastRun: session.lastRun,
            queuedEvents: session.eventQueue,
          })
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
      description: 'Read a bounded outline of generated lesson headings, recent stream items, active quiz, and concept progress. Does not return full lesson text.',
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
  }
}
