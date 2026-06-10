import { z } from 'zod'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import { readClassroomConcepts } from '@/lib/ai/classroom/read-models'
import { requireClassroom } from './shared'

export const readConceptsParameters = z.object({
  ids: z.array(z.string()).optional(),
})

export function readConcepts(bridge: AIClassroomBridgeValue, ids?: string[]) {
  const classroom = requireClassroom(bridge)
  const session = classroom.getSession()
  return readClassroomConcepts(session, bridge.uiLang, ids)
}
