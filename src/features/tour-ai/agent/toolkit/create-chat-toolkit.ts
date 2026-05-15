import type { Toolkit } from '@assistant-ui/react'
import { z } from 'zod'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import { createChatClassroomStateTools } from './classroom-state-tools'
import { createEditorTools } from './editor-tools'
import { createMcpCallTool } from './mcp-tools'
import { fail, ok } from './results'
import { requireClassroom } from './shared'

export function createClassroomChatToolkit(bridge: AIClassroomBridgeValue): Toolkit {
  return {
    ...createChatClassroomStateTools(bridge),
    ...createMcpCallTool(),

    emit_classroom_event: {
      description: 'Emit a structured learner intent for the lesson generation flow. Use when the learner asks to go deeper, slow down, change topic, or advance.',
      parameters: z.object({
        intent: z.union([
          z.literal('advance'),
          z.literal('go_deeper'),
          z.literal('slow_down'),
          z.literal('change_topic'),
          z.literal('explain_error'),
        ]),
        summary: z.string(),
      }),
      execute: async ({ intent, summary }) => {
        try {
          requireClassroom(bridge).dispatch({
            type: 'EMIT_CHAT_INTENT',
            intent,
            summary,
            now: Date.now(),
          })
          return ok()
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    ...createEditorTools(bridge),
  }
}
