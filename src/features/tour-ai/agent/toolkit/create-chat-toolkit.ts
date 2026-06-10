import type { Toolkit } from '@assistant-ui/react'
import { z } from 'zod'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import type { ChatIntentKind } from '@/lib/ai/classroom/types'
import type { ConceptValidationStatus } from '@/lib/ai/course-content/types'
import { createChatClassroomStateTools } from './classroom-state-tools'
import { createEditorTools } from './editor-tools'
import { createMcpCallTool } from './mcp-tools'
import { fail, ok } from './results'
import { requireClassroom } from './shared'
import { getDefaultCourseContentIndex } from '@/lib/ai/course-content/loader'
import { getChatIntentQueueBlock } from '@/lib/ai/classroom/chat-intent-guards'
import { resolveClarificationRetentionTarget } from './clarification-retention'

export function createClassroomChatToolkit(bridge: AIClassroomBridgeValue, options: { activeConceptId?: string } = {}): Toolkit {
  return {
    ...createChatClassroomStateTools(bridge),
    ...createMcpCallTool(),

    emit_classroom_event: {
      description: 'Emit a structured learner intent for the lesson generation flow. Use when the learner asks to go deeper, slow down, change topic, advance, explain an error, or start a review check.',
      parameters: z.object({
        intent: z.union([
          z.literal('advance'),
          z.literal('go_deeper'),
          z.literal('slow_down'),
          z.literal('change_topic'),
          z.literal('explain_error'),
          z.literal('review_check'),
        ]),
        summary: z.string(),
      }),
      execute: async ({ intent, summary }) => {
        try {
          const classroom = requireClassroom(bridge)
          const session = classroom.getSession()
          const blocked = getChatIntentQueueBlock(session, intent)

          if (blocked?.reason === 'active_exercise') {
            return fail(
              `Cannot emit "${intent}" while exercise ${blocked.exerciseId} is active. Ask the learner to finish, submit, or skip the current exercise first.`,
            )
          }
          if (blocked?.reason === 'queued_generation') {
            return fail('Classroom is already preparing the next step. Wait for the queued generation to finish before emitting another classroom event.')
          }
          const conceptBoundary = getChatIntentConceptBoundary(
            intent,
            options.activeConceptId,
            getDefaultCourseContentIndex().validation.conceptStatuses,
          )
          if (conceptBoundary)
            return fail(conceptBoundary)

          classroom.dispatch({
            type: 'EMIT_CHAT_INTENT',
            intent,
            summary,
            activeConceptId: options.activeConceptId,
            now: Date.now(),
          })
          return ok()
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    save_clarification: {
      description: 'Save a concise learner-specific Clarification to Review View. Use only when the chat exchange reveals an explanation worth reusing later; do not save raw transcript. Saving a clarification never creates Learning Evidence or updates Concept Progress.',
      parameters: z.object({
        conceptId: z.string().optional(),
        title: z.string().min(1).max(120),
        body: z.string().min(1).max(2000),
        summary: z.string().min(1).max(300),
      }),
      execute: async ({ conceptId, title, body, summary }) => {
        try {
          const classroom = requireClassroom(bridge)
          const session = classroom.getSession()
          const target = resolveClarificationRetentionTarget({
            conceptId,
            activeConceptId: options.activeConceptId,
            currentExerciseConceptIds: session.currentExercise?.conceptIds,
            trackTargetConceptId: session.track.targetConceptId,
            conceptStatuses: getDefaultCourseContentIndex().validation.conceptStatuses,
          })
          if (!target.ok)
            return fail(target.error)
          classroom.dispatch({
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
      },
    },

    ...createEditorTools(bridge),
  }
}

function getChatIntentConceptBoundary(
  intent: ChatIntentKind,
  activeConceptId: string | undefined,
  conceptStatuses: Record<string, ConceptValidationStatus | undefined>,
): string | null {
  if (!activeConceptId)
    return null

  const status = conceptStatuses[activeConceptId]
  if (!status || status === 'invalid') {
    return `Concept "${activeConceptId}" is not available for AI Classroom lesson generation. Answer directly in Chat instead of emitting a classroom event.`
  }

  if (status === 'read_only' && chatIntentRequiresValidatedConcept(intent)) {
    return `Cannot emit "${intent}" for read-only concept "${activeConceptId}". It can be explained in Chat, but it cannot drive mainline progress, topic changes, or review checks.`
  }

  return null
}

function chatIntentRequiresValidatedConcept(intent: ChatIntentKind): boolean {
  return intent === 'advance' || intent === 'change_topic' || intent === 'review_check'
}
