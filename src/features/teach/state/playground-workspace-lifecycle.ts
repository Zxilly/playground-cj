import { assign, createActor, setup } from 'xstate'

export type PlaygroundWorkspacePublicStatus
  = 'closed' | 'opening' | 'ready' | 'error'

type PlaygroundWorkspaceLifecycleEvent
  = { type: 'open' }
    | { type: 'open.succeeded' }
    | { type: 'open.failed' }
    | { type: 'workspace.corrupted' }
    | { type: 'retry' }
    | { type: 'close.started' }
    | { type: 'close.rejected' }
    | { type: 'close.succeeded' }

const playgroundWorkspaceLifecycleMachine = setup({
  types: {
    context: {} as {
      publicStatus: PlaygroundWorkspacePublicStatus
      resumeStatus: PlaygroundWorkspacePublicStatus
    },
    events: {} as PlaygroundWorkspaceLifecycleEvent,
  },
  actions: {
    markClosed: assign({ publicStatus: 'closed' }),
    markOpening: assign({ publicStatus: 'opening' }),
    markReady: assign({ publicStatus: 'ready' }),
    markError: assign({ publicStatus: 'error' }),
    rememberStatus: assign({
      resumeStatus: ({ context }) => context.publicStatus,
    }),
    restoreStatus: assign({
      publicStatus: ({ context }) => context.resumeStatus,
    }),
  },
  guards: {
    resumeDormant: ({ context }) => context.resumeStatus === 'closed',
    resumeOpening: ({ context }) => context.resumeStatus === 'opening',
    resumeError: ({ context }) => context.resumeStatus === 'error',
  },
}).createMachine({
  id: 'playgroundWorkspace',
  initial: 'dormant',
  context: {
    publicStatus: 'closed',
    resumeStatus: 'closed',
  },
  states: {
    dormant: {
      on: {
        'open': {
          target: 'opening',
          actions: 'markOpening',
        },
        'close.started': {
          target: 'closing',
          actions: 'rememberStatus',
        },
      },
    },
    opening: {
      on: {
        'open.succeeded': {
          target: 'ready',
          actions: 'markReady',
        },
        'open.failed': {
          target: 'error',
          actions: 'markError',
        },
        'close.started': {
          target: 'closing',
          actions: 'rememberStatus',
        },
      },
    },
    ready: {
      on: {
        'workspace.corrupted': {
          target: 'error',
          actions: 'markError',
        },
        'close.started': {
          target: 'closing',
          actions: 'rememberStatus',
        },
      },
    },
    error: {
      on: {
        'retry': {
          target: 'opening',
          actions: 'markOpening',
        },
        'close.started': {
          target: 'closing',
          actions: 'rememberStatus',
        },
      },
    },
    closing: {
      on: {
        'close.rejected': [
          {
            guard: 'resumeDormant',
            target: 'dormant',
            actions: 'restoreStatus',
          },
          {
            guard: 'resumeOpening',
            target: 'opening',
            actions: 'restoreStatus',
          },
          {
            guard: 'resumeError',
            target: 'error',
            actions: 'restoreStatus',
          },
          {
            target: 'ready',
            actions: 'restoreStatus',
          },
        ],
        'close.succeeded': {
          target: 'disposed',
          actions: 'markClosed',
        },
      },
    },
    disposed: {
      type: 'final',
    },
  },
})

export function createPlaygroundWorkspaceLifecycle() {
  const actor = createActor(playgroundWorkspaceLifecycleMachine).start()
  return {
    snapshot: () => actor.getSnapshot(),
    matches: (
      state: 'dormant' | 'opening' | 'ready' | 'error' | 'closing' | 'disposed',
    ) => actor.getSnapshot().matches(state),
    send: (event: PlaygroundWorkspaceLifecycleEvent) => actor.send(event),
    stop: () => actor.stop(),
  }
}
