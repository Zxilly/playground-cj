import { classroomReducer } from './reducer'
import type { ClassroomAction } from './reducer'
import type { ClassroomSession } from './types'
import type { AIBridgeValue, AIClassroomBridge } from '@/components/tour/EditorBridgeContext'

export interface ClassroomTransaction {
  bridge: AIBridgeValue
  commit: (extraActions?: ClassroomAction[]) => void
  discard: () => void
}

export function createClassroomTransaction(bridge: AIBridgeValue): ClassroomTransaction {
  const baseClassroom = bridge.classroom
  if (!baseClassroom)
    throw new Error('Cannot create classroom transaction without classroom bridge')

  const actions: ClassroomAction[] = []

  function reduceBuffered(baseSession: ClassroomSession): ClassroomSession {
    return actions.reduce((nextSession, action) => classroomReducer(nextSession, action), baseSession)
  }

  const transactionalClassroom: AIClassroomBridge = {
    ...baseClassroom,
    getSession: () => reduceBuffered(baseClassroom.getSession()),
    dispatch: (action: ClassroomAction) => {
      actions.push(action)
    },
  }

  return {
    bridge: {
      ...bridge,
      classroom: transactionalClassroom,
    },
    commit: (extraActions: ClassroomAction[] = []) => {
      const batch = [...actions, ...extraActions]
      actions.length = 0
      if (batch.length > 0)
        baseClassroom.dispatch({ type: 'BATCH', actions: batch })
    },
    discard: () => {
      actions.length = 0
    },
  }
}
