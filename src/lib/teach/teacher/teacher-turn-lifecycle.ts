import type { SettleAwareOperationOwnership } from '@/lib/ai/settle-aware-operation-ownership'
import { createSettleAwareOperationOwnership } from '@/lib/ai/settle-aware-operation-ownership'
import { createActor, setup } from 'xstate'

export type TeacherTurnOwnership = Pick<
  SettleAwareOperationOwnership,
  'wait' | 'observe' | 'finish'
>

/**
 * Retains a teacher-turn lease until both the stream protocol has finished
 * and every raw provider operation has actually settled.
 */
export function createTeacherTurnOwnership(
  release: () => void,
): TeacherTurnOwnership {
  return createSettleAwareOperationOwnership(release)
}

/**
 * Synchronous admission seam for the one prepared turn allowed by a
 * transport. Ownership release is the only transition back to idle.
 */
export function createTeacherTurnAdmission() {
  const actor = createActor(setup({
    types: {
      events: {} as { type: 'acquire' } | { type: 'release' },
    },
  }).createMachine({
    id: 'teacherTurnAdmission',
    initial: 'idle',
    states: {
      idle: {
        on: { acquire: 'active' },
      },
      active: {
        on: { release: 'idle' },
      },
    },
  })).start()

  return {
    tryAcquire(): boolean {
      if (!actor.getSnapshot().matches('idle'))
        return false
      actor.send({ type: 'acquire' })
      return true
    },
    release() {
      actor.send({ type: 'release' })
    },
  }
}
