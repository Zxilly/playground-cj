import type { WorkspaceCollaborators } from './workspace-collaborators'
import { assign, setup } from 'xstate'

interface TeachRuntimeContext {
  generation: number
  collaborators: WorkspaceCollaborators | null
  message: string | null
}

type TeachRuntimeEvent
  = { type: 'open.succeeded', collaborators: WorkspaceCollaborators }
    | { type: 'open.failed', message: string }
    | { type: 'storage.failed', message: string }
    | { type: 'retry' }

export const teachRuntimeMachine = setup({
  types: {
    context: {} as TeachRuntimeContext,
    events: {} as TeachRuntimeEvent,
  },
  actions: {
    acceptCollaborators: assign({
      collaborators: ({ event }) =>
        event.type === 'open.succeeded' ? event.collaborators : null,
      message: null,
    }),
    recordFailure: assign({
      collaborators: null,
      message: ({ event }) =>
        event.type === 'open.failed' || event.type === 'storage.failed'
          ? event.message
          : null,
    }),
    beginRetry: assign({
      generation: ({ context }) => context.generation + 1,
      collaborators: null,
      message: null,
    }),
  },
}).createMachine({
  id: 'teachRuntime',
  initial: 'loading',
  context: {
    generation: 0,
    collaborators: null,
    message: null,
  },
  states: {
    loading: {
      on: {
        'open.succeeded': {
          target: 'ready',
          actions: 'acceptCollaborators',
        },
        'open.failed': {
          target: 'error',
          actions: 'recordFailure',
        },
        'storage.failed': {
          target: 'error',
          actions: 'recordFailure',
        },
      },
    },
    ready: {
      on: {
        'storage.failed': {
          target: 'error',
          actions: 'recordFailure',
        },
      },
    },
    error: {
      on: {
        retry: {
          target: 'loading',
          actions: 'beginRetry',
        },
      },
    },
  },
})
