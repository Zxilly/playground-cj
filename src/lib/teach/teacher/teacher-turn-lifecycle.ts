import { awaitWithSignal } from '@/lib/ai/abortable-operation'
import { assign, createActor, setup } from 'xstate'

export interface TeacherTurnOwnership {
  readonly wait: <T>(
    operation: PromiseLike<T>,
    signal: AbortSignal,
  ) => Promise<T>
  readonly observe: (operation: PromiseLike<unknown>) => Promise<void>
  readonly finish: () => void
}

type OwnershipEvent
  = { type: 'operation.started' }
    | { type: 'operation.settled' }
    | { type: 'finish' }

/**
 * Retains a teacher-turn lease until both the stream protocol has finished
 * and every raw provider operation has actually settled.
 */
export function createTeacherTurnOwnership(
  release: () => void,
): TeacherTurnOwnership {
  const machine = setup({
    types: {
      context: {} as { pendingOperations: number },
      events: {} as OwnershipEvent,
    },
    actions: {
      incrementPending: assign({
        pendingOperations: ({ context }) => context.pendingOperations + 1,
      }),
      decrementPending: assign({
        pendingOperations: ({ context }) =>
          Math.max(0, context.pendingOperations - 1),
      }),
      release,
    },
    guards: {
      hasNoPendingOperations: ({ context }) =>
        context.pendingOperations === 0,
      isLastPendingOperation: ({ context }) =>
        context.pendingOperations === 1,
    },
  }).createMachine({
    id: 'teacherTurnOwnership',
    initial: 'open',
    context: { pendingOperations: 0 },
    states: {
      open: {
        on: {
          'operation.started': { actions: 'incrementPending' },
          'operation.settled': { actions: 'decrementPending' },
          'finish': [
            {
              guard: 'hasNoPendingOperations',
              target: 'released',
            },
            { target: 'draining' },
          ],
        },
      },
      draining: {
        on: {
          'operation.started': { actions: 'incrementPending' },
          'operation.settled': [
            {
              guard: 'isLastPendingOperation',
              target: 'released',
              actions: 'decrementPending',
            },
            { actions: 'decrementPending' },
          ],
          'finish': {},
        },
      },
      released: {
        entry: 'release',
        type: 'final',
      },
    },
  })
  const actor = createActor(machine).start()

  const track = <T>(operation: PromiseLike<T>): Promise<T> => {
    actor.send({ type: 'operation.started' })
    const tracked = Promise.resolve(operation)
    tracked.then(
      () => actor.send({ type: 'operation.settled' }),
      () => actor.send({ type: 'operation.settled' }),
    )
    return tracked
  }

  return {
    wait: <T>(operation: PromiseLike<T>, signal: AbortSignal) =>
      awaitWithSignal(track(operation), signal),
    observe: operation => track(operation).then(
      () => undefined,
      () => undefined,
    ),
    finish: () => actor.send({ type: 'finish' }),
  }
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
