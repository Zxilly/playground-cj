import type { ChatIntentKind, ClassroomSession } from './types'

export type ChatIntentQueueBlock
  = | { reason: 'active_exercise', exerciseId: string }
    | { reason: 'queued_generation' }

export function chatIntentRequiresResolvedExercise(intent: ChatIntentKind): boolean {
  return intent === 'advance' || intent === 'review_check' || intent === 'change_topic'
}

export function getChatIntentQueueBlock(session: ClassroomSession, intent: ChatIntentKind): ChatIntentQueueBlock | null {
  const activeExercise = session.currentExercise?.status === 'active' ? session.currentExercise : null
  if (activeExercise && chatIntentRequiresResolvedExercise(intent))
    return { reason: 'active_exercise', exerciseId: activeExercise.id }
  if (session.eventQueue.length > 0)
    return { reason: 'queued_generation' }
  return null
}
