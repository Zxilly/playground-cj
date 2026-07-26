import type {
  CreateWorkspaceCollaboratorsOptions,
  WorkspaceCollaborators,
} from './workspace-collaborators'
import { assign, fromCallback, sendTo, setup } from 'xstate'

interface TeachRuntimeContext {
  collaborators: WorkspaceCollaborators | null
  message: string | null
}

type TeachRuntimeEvent
  = { type: 'open.succeeded', collaborators: WorkspaceCollaborators }
    | { type: 'open.failed', message: string }
    | { type: 'resource.failed', message: string }
    | { type: 'retry' }

interface TeachRuntimeResourceEvent { type: 'retry' }

export interface TeachRuntimeMachineDependencies {
  locale: 'en' | 'zh'
  open: (
    locale: 'en' | 'zh',
    options: CreateWorkspaceCollaboratorsOptions,
  ) => Promise<WorkspaceCollaborators>
  resetWorkspace: () => void
  reportDisposeError: (error: unknown, context: string) => void
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Own the complete process-local lifetime of one AI Classroom workspace.
 * The underlying collaborator Module retains its lease until raw open/dispose
 * operations settle; stopping this actor never treats AbortSignal as proof
 * that those operations ended.
 */
export function createTeachRuntimeMachine(
  dependencies: TeachRuntimeMachineDependencies,
) {
  const workspaceResource = fromCallback<TeachRuntimeResourceEvent>(
    ({ receive, sendBack }) => {
      let active = true
      let controller: AbortController | null = null
      let collaborators: WorkspaceCollaborators | null = null
      let disposal: Promise<void> | null = null
      let storageFailure: string | null = null
      let failureReported = false

      const dispose = (context: string): Promise<void> => {
        if (disposal)
          return disposal
        const owned = collaborators
        collaborators = null
        if (!owned)
          return Promise.resolve()
        disposal = owned.dispose().catch((error: unknown) => {
          dependencies.reportDisposeError(error, context)
        })
        return disposal
      }

      const reportResourceFailure = async (
        message: string,
        context: string,
      ) => {
        if (failureReported)
          return
        failureReported = true
        await dispose(context)
        if (active)
          sendBack({ type: 'resource.failed', message })
      }

      const open = () => {
        controller = new AbortController()
        collaborators = null
        disposal = null
        storageFailure = null
        failureReported = false
        dependencies.resetWorkspace()

        void dependencies.open(dependencies.locale, {
          signal: controller.signal,
          onStorageError: (error) => {
            if (!active || failureReported)
              return
            storageFailure = errorMessage(error)
            if (collaborators) {
              void reportResourceFailure(
                storageFailure,
                'failed to dispose after a storage error',
              )
            }
          },
        }).then(async (created) => {
          collaborators = created
          if (!active) {
            await dispose('failed to dispose an obsolete runtime')
            return
          }
          if (storageFailure !== null) {
            await reportResourceFailure(
              storageFailure,
              'failed to dispose after a storage error',
            )
            return
          }
          sendBack({ type: 'open.succeeded', collaborators: created })
        }).catch((error: unknown) => {
          if (
            active
            && !controller?.signal.aborted
            && storageFailure === null
          ) {
            sendBack({ type: 'open.failed', message: errorMessage(error) })
          }
        })
      }

      receive((event) => {
        if (event.type === 'retry')
          open()
      })
      open()

      return () => {
        active = false
        controller?.abort()
        void dispose('failed to dispose the workspace runtime')
      }
    },
  )

  return setup({
    types: {
      context: {} as TeachRuntimeContext,
      events: {} as TeachRuntimeEvent,
    },
    actors: {
      workspaceResource,
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
          event.type === 'open.failed' || event.type === 'resource.failed'
            ? event.message
            : null,
      }),
      beginRetry: assign({
        collaborators: null,
        message: null,
      }),
      retryResource: sendTo('workspaceResource', { type: 'retry' }),
    },
  }).createMachine({
    id: 'teachRuntime',
    initial: 'loading',
    context: {
      collaborators: null,
      message: null,
    },
    invoke: {
      id: 'workspaceResource',
      src: 'workspaceResource',
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
          'resource.failed': {
            target: 'error',
            actions: 'recordFailure',
          },
        },
      },
      ready: {
        on: {
          'resource.failed': {
            target: 'error',
            actions: 'recordFailure',
          },
        },
      },
      error: {
        on: {
          retry: {
            target: 'loading',
            actions: ['beginRetry', 'retryResource'],
          },
        },
      },
    },
  })
}
