import type { RunResult } from '@/lib/teach/feedback/run-cangjie'
import { awaitWithSignal } from '@/lib/ai/abortable-operation'
import {
  assign,
  createActor,
  fromCallback,
  fromPromise,
  setup,
} from 'xstate'

let nextRunOwnerEpoch = 1

interface PlaygroundRunContext {
  operationId: string | null
  contentVersion: string | null
  code: string | null
}

type PlaygroundRunEvent
  = { type: 'run.requested', code: string, contentVersion: string }
    | { type: 'source.changed', contentVersion: string | null }
    | { type: 'cancel' }
    | { type: 'xstate.done.actor.executeRun', output: RunResult | undefined }

export interface PlaygroundRunMachineDependencies {
  tabId: string
  workspaceSignal: AbortSignal
  begin: (tabId: string, ownerEpoch: number) => string | null
  finish: (
    tabId: string,
    operationId: string,
    result?: RunResult,
  ) => void
  releaseOwner: (ownerEpoch: number) => void
  run: (code: string, signal: AbortSignal) => Promise<RunResult>
  getContentVersion: (tabId: string) => string | null
  subscribeToSource: (listener: () => void) => () => void
}

function unavailableResult(error: unknown): RunResult {
  return {
    ok: false,
    phase: null,
    stdout: '',
    stdoutTruncated: false,
    stderr: '',
    stderrTruncated: false,
    compilerOutput: '',
    compilerOutputTruncated: false,
    exitCode: null,
    failureKind: 'runner_unavailable',
    failureMessage: error instanceof Error ? error.message : String(error),
  }
}

/**
 * One process-local actor per Playground tab. It owns cancellation,
 * source-version observation, runner invocation, and the store projection
 * lease. The persisted draft CAS remains independent from run state.
 */
export function createPlaygroundRunActor(
  dependencies: PlaygroundRunMachineDependencies,
) {
  const ownerEpoch = nextRunOwnerEpoch++
  const sourceLifetime = fromCallback<PlaygroundRunEvent>(({ sendBack }) => {
    const publishSource = () => sendBack({
      type: 'source.changed',
      contentVersion: dependencies.getContentVersion(dependencies.tabId),
    })
    const abort = () => sendBack({ type: 'cancel' })
    const unsubscribe = dependencies.subscribeToSource(publishSource)
    if (dependencies.workspaceSignal.aborted)
      abort()
    else
      dependencies.workspaceSignal.addEventListener('abort', abort)

    return () => {
      dependencies.workspaceSignal.removeEventListener('abort', abort)
      unsubscribe()
      dependencies.releaseOwner(ownerEpoch)
    }
  })
  const executeRun = fromPromise<
    RunResult | undefined,
    { code: string }
  >(async ({ input, signal }) => {
    try {
      return await awaitWithSignal(
        dependencies.run(input.code, signal),
        signal,
      )
    }
    catch (error) {
      if (signal.aborted)
        return undefined
      return unavailableResult(error)
    }
  })

  const machine = setup({
    types: {
      context: {} as PlaygroundRunContext,
      events: {} as PlaygroundRunEvent,
    },
    actors: {
      executeRun,
      sourceLifetime,
    },
    actions: {
      acceptRequest: assign({
        code: ({ event }) =>
          event.type === 'run.requested' ? event.code : null,
        contentVersion: ({ event }) =>
          event.type === 'run.requested' ? event.contentVersion : null,
      }),
      beginOperation: assign({
        operationId: () => dependencies.begin(
          dependencies.tabId,
          ownerEpoch,
        ),
      }),
      finishOperation: assign(({ context, event }) => {
        if (context.operationId !== null) {
          dependencies.finish(
            dependencies.tabId,
            context.operationId,
            event.type === 'xstate.done.actor.executeRun'
              ? event.output
              : undefined,
          )
        }
        return {
          operationId: null,
          contentVersion: null,
          code: null,
        }
      }),
    },
    guards: {
      operationStarted: ({ context }) => context.operationId !== null,
      sourceChanged: ({ context, event }) =>
        event.type === 'source.changed'
        && event.contentVersion !== context.contentVersion,
    },
  }).createMachine({
    id: `playgroundRun:${dependencies.tabId}`,
    initial: 'idle',
    context: {
      operationId: null,
      contentVersion: null,
      code: null,
    },
    invoke: {
      id: 'sourceLifetime',
      src: 'sourceLifetime',
    },
    states: {
      idle: {
        on: {
          'run.requested': {
            target: 'starting',
            actions: 'acceptRequest',
          },
        },
      },
      starting: {
        entry: 'beginOperation',
        always: [
          { guard: 'operationStarted', target: 'running' },
          { target: 'idle' },
        ],
      },
      running: {
        invoke: {
          id: 'executeRun',
          src: 'executeRun',
          input: ({ context }) => ({ code: context.code ?? '' }),
          onDone: {
            target: 'idle',
            actions: 'finishOperation',
          },
          onError: {
            target: 'idle',
            actions: 'finishOperation',
          },
        },
        on: {
          'source.changed': {
            guard: 'sourceChanged',
            target: 'idle',
            actions: 'finishOperation',
          },
          'cancel': {
            target: 'idle',
            actions: 'finishOperation',
          },
        },
      },
    },
  })

  return createActor(machine).start()
}
