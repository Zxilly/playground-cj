import type { AIClassroom } from '@/lib/teach/classroom/ai-classroom'
import type {
  RemediationDiagnosticClaimAuthority,
  ReviewArtifact,
} from '@/lib/teach/classroom/state'
import { runAutomaticRemediationJob } from '../components/automatic-remediation-job'
import { assign, fromPromise, setup } from 'xstate'

const INFRASTRUCTURE_RETRY_BASE_MS = 500
const INFRASTRUCTURE_RETRY_MAX_MS = 4_000
const INFRASTRUCTURE_MAX_ATTEMPTS = 5
const MAX_TIMER_DELAY_MS = 2_147_483_647

export interface PendingRemediationJob {
  artifactId: string
  failedAttemptId: string
  diagnosticAttempt: number
  nextDiagnosticAttemptAt: number | null
  diagnosticClaim: RemediationDiagnosticClaimAuthority | null
  updatedAt: number
}

interface RemediationCoordinatorContext {
  jobs: PendingRemediationJob[]
  dueJobs: PendingRemediationJob[]
  wakeAt: number | null
  infrastructureAttempts: Record<string, number>
  jobsGeneration: number
  passGeneration: number
  completedPassJobKeys: string[]
}

type RemediationCoordinatorEvent
  = {
    type: 'jobs.changed'
    jobs: PendingRemediationJob[]
  }
  | {
    type: 'xstate.done.actor.remediationPass'
    output: RemediationPassOutput
  }

interface RemediationPassInput {
  jobs: PendingRemediationJob[]
  infrastructureAttempts: Record<string, number>
}

interface RemediationPassOutput {
  wakeAt: number | null
  infrastructureAttempts: Record<string, number>
  completedJobKeys: string[]
}

export interface AutomaticRemediationCoordinatorDependencies {
  classroom: AIClassroom
  generate: (
    failedAttemptId: string,
    diagnosticClaim: RemediationDiagnosticClaimAuthority,
    abortSignal: AbortSignal,
  ) => Promise<boolean>
  now: () => number
  waitForLocalIdle: (signal: AbortSignal) => Promise<void>
  monotonicNow?: () => number
  withJobLock?: <T>(
    failedAttemptId: string,
    run: () => Promise<T>,
    unavailable: () => T,
  ) => Promise<T>
  createOwnerNonce?: () => string
}

function createRemediationOwnerNonce(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function')
    return `remediation-owner:${globalThis.crypto.randomUUID()}`
  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    throw new TypeError(
      'Web Crypto is required to claim a Remediation diagnostic',
    )
  }
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
  return `remediation-owner:${[...bytes]
    .map(value => value.toString(16).padStart(2, '0'))
    .join('')}`
}

async function withOptionalWebLock<T>(
  failedAttemptId: string,
  run: () => Promise<T>,
  unavailable: () => T,
): Promise<T> {
  const lockManager = globalThis.navigator?.locks
  if (!lockManager)
    return run()
  return lockManager.request(
    `playground-cj:remediation:${failedAttemptId}`,
    { mode: 'exclusive', ifAvailable: true },
    lock => lock ? run() : unavailable(),
  )
}

function jobKey(job: {
  artifactId: string
  failedAttemptId: string
  diagnosticAttempt: number
}): string {
  return `${job.artifactId}\u0000${job.failedAttemptId}`
    + `\u0000${job.diagnosticAttempt}`
}

export function selectPendingRemediationJobs(
  artifacts: ReviewArtifact[],
): PendingRemediationJob[] {
  return artifacts
    .filter((artifact): artifact is Extract<
      ReviewArtifact,
      { type: 'remediation' }
    > =>
      artifact.type === 'remediation'
      && artifact.diagnosticStatus === 'pending')
    .map(artifact => ({
      artifactId: artifact.id,
      failedAttemptId: artifact.attemptIds[0]!,
      diagnosticAttempt: artifact.diagnosticAttempts + 1,
      nextDiagnosticAttemptAt: artifact.nextDiagnosticAttemptAt,
      diagnosticClaim: artifact.diagnosticClaim ?? null,
      updatedAt: artifact.updatedAt,
    }))
}

/**
 * Owns the process-local scheduling and execution effects for automatic
 * Remediation. The AI Classroom aggregate remains the authority for job
 * identity, retry timestamps, and durable diagnostic claims.
 */
export function createAutomaticRemediationCoordinatorMachine(
  dependencies: AutomaticRemediationCoordinatorDependencies,
) {
  const monotonicNow = dependencies.monotonicNow
    ?? (() => globalThis.performance.now())
  const runWithLock = dependencies.withJobLock ?? withOptionalWebLock
  const ownerNonce = dependencies.createOwnerNonce
    ?? createRemediationOwnerNonce
  let causalClock: {
    value: number
    observedMonotonicTime: number
  } | null = null

  const readCausalNow = (persistedFloor: number): number => {
    const monotonicTime = monotonicNow()
    const advanced = causalClock === null
      ? persistedFloor
      : causalClock.value + Math.max(
        0,
        monotonicTime - causalClock.observedMonotonicTime,
      )
    const value = Math.max(dependencies.now(), persistedFloor, advanced)
    causalClock = { value, observedMonotonicTime: monotonicTime }
    return Math.floor(value)
  }

  const remediationPass = fromPromise<
    RemediationPassOutput,
    RemediationPassInput
  >(async ({ input, signal }) => {
    let wakeAt: number | null = null
    const infrastructureAttempts = { ...input.infrastructureAttempts }
    const requestWake = (timestamp: number) => {
      wakeAt = wakeAt === null ? timestamp : Math.min(wakeAt, timestamp)
    }
    const resetInfrastructureAttempts = (job: PendingRemediationJob) => {
      delete infrastructureAttempts[jobKey(job)]
    }
    const retryInfrastructureFailure = (job: PendingRemediationJob) => {
      const key = jobKey(job)
      const attempt = (infrastructureAttempts[key] ?? 0) + 1
      infrastructureAttempts[key] = attempt
      if (attempt >= INFRASTRUCTURE_MAX_ATTEMPTS)
        return
      const delay = Math.min(
        INFRASTRUCTURE_RETRY_BASE_MS * 2 ** (attempt - 1),
        INFRASTRUCTURE_RETRY_MAX_MS,
      )
      requestWake(readCausalNow(job.updatedAt) + delay)
    }

    for (const job of input.jobs) {
      if (signal.aborted)
        break
      try {
        await dependencies.waitForLocalIdle(signal)
        signal.throwIfAborted()
        const runIfCurrent = async () => {
          const current = dependencies.classroom.snapshot()
            .reviewArtifacts
            .find(
              (artifact): artifact is Extract<
                ReviewArtifact,
                { type: 'remediation' }
              > =>
                artifact.type === 'remediation'
                && artifact.diagnosticStatus === 'pending'
                && artifact.id === job.artifactId,
            )
          if (!current)
            return { handled: true, retryAt: null }
          const observedAt = readCausalNow(current.updatedAt)
          if (
            current.nextDiagnosticAttemptAt !== null
            && current.nextDiagnosticAttemptAt > observedAt
          ) {
            return {
              handled: true,
              retryAt: current.nextDiagnosticAttemptAt,
            }
          }
          if (current.diagnosticClaim !== null) {
            return { handled: true, retryAt: null }
          }
          return runAutomaticRemediationJob({
            classroom: dependencies.classroom,
            job: {
              artifactId: current.id,
              failedAttemptId: current.attemptIds[0]!,
              diagnosticAttempt: current.diagnosticAttempts + 1,
            },
            ownerNonce: ownerNonce(),
            observedAt,
            abortSignal: signal,
            generate: dependencies.generate,
          })
        }

        const result = await runWithLock(
          job.failedAttemptId,
          runIfCurrent,
          () => ({ handled: false, retryAt: null }),
        )
        if (result.retryAt !== null)
          requestWake(result.retryAt)
        else if (!result.handled)
          retryInfrastructureFailure(job)
        else
          resetInfrastructureAttempts(job)
      }
      catch {
        if (
          !signal.aborted
        ) {
          retryInfrastructureFailure(job)
        }
      }
    }
    return {
      wakeAt,
      infrastructureAttempts,
      completedJobKeys: input.jobs.map(jobKey),
    }
  })

  return setup({
    types: {
      context: {} as RemediationCoordinatorContext,
      events: {} as RemediationCoordinatorEvent,
    },
    actors: {
      remediationPass,
    },
    delays: {
      scheduledWake: ({ context }) => Math.min(
        Math.max(
          0,
          (context.wakeAt ?? readCausalNow(0)) - readCausalNow(0),
        ),
        MAX_TIMER_DELAY_MS,
      ),
    },
    actions: {
      acceptJobs: assign({
        jobs: ({ event }) =>
          event.type === 'jobs.changed' ? event.jobs : [],
        wakeAt: null,
        jobsGeneration: ({ context }) => context.jobsGeneration + 1,
        completedPassJobKeys: [],
      }),
      acceptJobsDuringPass: assign({
        jobs: ({ event }) =>
          event.type === 'jobs.changed' ? event.jobs : [],
        jobsGeneration: ({ context }) => context.jobsGeneration + 1,
      }),
      planJobs: assign(({ context }) => {
        if (context.jobs.length === 0)
          return { dueJobs: [], wakeAt: null }
        const eligibleJobs = context.jobs.filter(
          job => !context.completedPassJobKeys.includes(jobKey(job)),
        )
        const persistedFloor = eligibleJobs.reduce(
          (latest, job) => Math.max(latest, job.updatedAt),
          0,
        )
        // A fired actor timer is itself monotonic evidence that its scheduled
        // boundary was reached, even when the wall clock rolled backwards.
        const currentTime = Math.max(
          readCausalNow(persistedFloor),
          context.wakeAt ?? 0,
        )
        const dueJobs = eligibleJobs.filter(job =>
          (
            job.nextDiagnosticAttemptAt === null
            || job.nextDiagnosticAttemptAt <= currentTime
          )
          && job.diagnosticClaim === null)
        const wakeAt = eligibleJobs.reduce<number | null>((next, job) => {
          if (
            job.diagnosticClaim !== null
            || job.nextDiagnosticAttemptAt === null
            || job.nextDiagnosticAttemptAt <= currentTime
          ) {
            return next
          }
          return next === null
            ? job.nextDiagnosticAttemptAt
            : Math.min(next, job.nextDiagnosticAttemptAt)
        }, null)
        return { dueJobs, wakeAt }
      }),
      acceptPassResult: assign({
        wakeAt: ({ event }) =>
          event.type === 'xstate.done.actor.remediationPass'
            ? event.output.wakeAt
            : null,
        infrastructureAttempts: ({ event }) =>
          event.type === 'xstate.done.actor.remediationPass'
            ? event.output.infrastructureAttempts
            : {},
        completedPassJobKeys: ({ event }) =>
          event.type === 'xstate.done.actor.remediationPass'
            ? event.output.completedJobKeys
            : [],
      }),
      reachScheduledWake: ({ context }) => {
        if (context.wakeAt === null)
          return
        causalClock = {
          value: Math.max(causalClock?.value ?? 0, context.wakeAt),
          observedMonotonicTime: monotonicNow(),
        }
      },
      markPassGeneration: assign({
        passGeneration: ({ context }) => context.jobsGeneration,
      }),
      clearCompletedPass: assign({
        completedPassJobKeys: [],
      }),
    },
    guards: {
      hasDueJobs: ({ context }) => context.dueJobs.length > 0,
      hasScheduledWake: ({ context }) => context.wakeAt !== null,
      jobsChangedDuringPass: ({ context }) =>
        context.jobsGeneration !== context.passGeneration,
    },
  }).createMachine({
    id: 'automaticRemediationCoordinator',
    initial: 'idle',
    context: {
      jobs: [],
      dueJobs: [],
      wakeAt: null,
      infrastructureAttempts: {},
      jobsGeneration: 0,
      passGeneration: 0,
      completedPassJobKeys: [],
    },
    states: {
      idle: {
        on: {
          'jobs.changed': {
            target: 'planning',
            actions: 'acceptJobs',
          },
        },
      },
      planning: {
        entry: 'planJobs',
        always: [
          { guard: 'hasDueJobs', target: 'running' },
          { guard: 'hasScheduledWake', target: 'waiting' },
          { target: 'idle' },
        ],
      },
      waiting: {
        after: {
          scheduledWake: {
            target: 'planning',
            actions: ['reachScheduledWake', 'clearCompletedPass'],
          },
        },
        on: {
          'jobs.changed': {
            target: 'planning',
            actions: 'acceptJobs',
          },
        },
      },
      running: {
        entry: 'markPassGeneration',
        invoke: {
          id: 'remediationPass',
          src: 'remediationPass',
          input: ({ context }) => ({
            jobs: context.dueJobs,
            infrastructureAttempts: context.infrastructureAttempts,
          }),
          onDone: {
            target: 'afterRun',
            actions: 'acceptPassResult',
          },
          onError: 'idle',
        },
        on: {
          'jobs.changed': {
            actions: 'acceptJobsDuringPass',
          },
        },
      },
      afterRun: {
        always: [
          { guard: 'jobsChangedDuringPass', target: 'planning' },
          { guard: 'hasScheduledWake', target: 'waiting' },
          { target: 'idle' },
        ],
      },
    },
  })
}
