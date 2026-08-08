import { createActor } from 'xstate'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AIClassroom } from '@/lib/teach/classroom/ai-classroom'
import { createEmptyClassroom } from '@/lib/teach/classroom/state'
import {
  createAutomaticRemediationCoordinatorMachine,
  startAutomaticRemediationCoordinator,
} from './automatic-remediation-coordinator'

describe('automatic remediation coordinator machine', () => {
  afterEach(() => vi.useRealTimers())

  it('uses the persisted clock floor to cross a retry after wall-clock rollback', async () => {
    vi.useFakeTimers()
    const actor = createActor(createAutomaticRemediationCoordinatorMachine({
      classroom: {
        snapshot: () => createEmptyClassroom(),
      } as AIClassroom,
      generate: vi.fn(),
      now: () => 1_000,
      waitForLocalIdle: vi.fn(async () => undefined),
      withJobLock: async (_failedAttemptId, run) => run(),
    })).start()

    actor.send({
      type: 'jobs.changed',
      jobs: [{
        artifactId: 'remediation:pending',
        failedAttemptId: 'attempt:failed',
        diagnosticAttempt: 2,
        nextDiagnosticAttemptAt: 10_500,
        diagnosticClaim: null,
        updatedAt: 10_000,
      }],
    })

    expect(actor.getSnapshot().matches('waiting')).toBe(true)
    await vi.advanceTimersByTimeAsync(500)
    expect(actor.getSnapshot().matches('idle')).toBe(true)
    actor.stop()
  })

  it('owns the classroom subscription until the coordinator is disposed', () => {
    const unsubscribe = vi.fn()
    const subscribe = vi.fn(() => unsubscribe)
    const classroom = {
      snapshot: () => createEmptyClassroom(),
      subscribe,
    } as unknown as AIClassroom

    const coordinator = startAutomaticRemediationCoordinator({
      classroom,
      generate: vi.fn(),
      now: () => 1_000,
      waitForLocalIdle: vi.fn(async () => undefined),
    })

    expect(subscribe).toHaveBeenCalledOnce()
    expect(unsubscribe).not.toHaveBeenCalled()

    coordinator.dispose()
    coordinator.dispose()

    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
