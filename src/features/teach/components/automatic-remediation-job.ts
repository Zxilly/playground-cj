import type { AIClassroom } from '@/lib/teach/classroom/ai-classroom'
import type {
  RemediationDiagnosticClaimAuthority,
  RemediationDiagnosticJob,
  ReviewArtifact,
} from '@/lib/teach/classroom/state'
import {
  remediationDiagnosticContextAvailability,
} from '@/lib/teach/teacher/toolkit'

export class RemediationJobBusyError extends Error {
  constructor() {
    super('A Remediation diagnostic job is already running')
    this.name = 'RemediationJobBusyError'
  }
}

export class RemediationJobCancelledError extends Error {
  constructor() {
    super('The Remediation diagnostic generation was cancelled')
    this.name = 'RemediationJobCancelledError'
  }
}

interface AutomaticRemediationJobOptions {
  classroom: AIClassroom
  job: RemediationDiagnosticJob
  ownerNonce: string
  observedAt: number
  abortSignal: AbortSignal
  generate: (
    failedAttemptId: string,
    claim: RemediationDiagnosticClaimAuthority,
    abortSignal: AbortSignal,
  ) => Promise<boolean>
}

export interface AutomaticRemediationJobResult {
  handled: boolean
  retryAt: number | null
}

function ownsClaim(
  artifact: Extract<ReviewArtifact, { type: 'remediation' }> | undefined,
  authority: RemediationDiagnosticClaimAuthority,
): boolean {
  const claim = artifact?.diagnosticClaim
  return claim?.ownerNonce === authority.ownerNonce
    && claim.job.artifactId === authority.job.artifactId
    && claim.job.failedAttemptId === authority.job.failedAttemptId
    && claim.job.diagnosticAttempt === authority.job.diagnosticAttempt
}

/**
 * Acquire one durable CAS-backed diagnostic claim before invoking the model.
 * The aggregate is the source of ownership; Web Locks may reduce contention
 * around this operation but are never required for correctness.
 */
export async function runAutomaticRemediationJob(
  options: AutomaticRemediationJobOptions,
): Promise<AutomaticRemediationJobResult> {
  const {
    abortSignal,
    classroom,
    generate,
    job,
    observedAt,
    ownerNonce,
  } = options
  abortSignal.throwIfAborted()
  const authority: RemediationDiagnosticClaimAuthority = {
    job,
    ownerNonce,
  }
  const claimed = await classroom.execute({
    type: 'claim_remediation_diagnostic',
    job,
    ownerNonce,
    observedAt,
  })
  const claimedArtifact = claimed.reviewArtifacts.find(
    (artifact): artifact is Extract<ReviewArtifact, { type: 'remediation' }> =>
      artifact.type === 'remediation' && artifact.id === job.artifactId,
  )
  if (!ownsClaim(claimedArtifact, authority)) {
    return {
      // Another durable owner is handling this pending job. Treat this
      // scheduling pass as complete: polling or an expiry-based wakeup could
      // start a duplicate call while that owner's provider promise still runs.
      handled: true,
      retryAt: null,
    }
  }

  try {
    abortSignal.throwIfAborted()
    const contextAvailability = remediationDiagnosticContextAvailability(
      classroom.snapshot(),
      job.failedAttemptId,
    )
    if (contextAvailability === 'missing')
      return { handled: true, retryAt: null }
    if (contextAvailability === 'too_large') {
      await classroom.execute({
        type: 'record_remediation_diagnostic_failure',
        failedAttemptId: job.failedAttemptId,
        diagnosticAttempt: job.diagnosticAttempt,
        failure: 'context_too_large',
        diagnosticClaim: authority,
      })
      return { handled: true, retryAt: null }
    }

    let retained: boolean
    try {
      retained = await generate(
        job.failedAttemptId,
        authority,
        abortSignal,
      )
    }
    catch (error) {
      if (abortSignal.aborted)
        return { handled: true, retryAt: null }
      if (error instanceof RemediationJobCancelledError)
        return { handled: true, retryAt: null }
      if (error instanceof RemediationJobBusyError)
        return { handled: false, retryAt: null }
      await classroom.execute({
        type: 'record_remediation_diagnostic_failure',
        failedAttemptId: job.failedAttemptId,
        diagnosticAttempt: job.diagnosticAttempt,
        failure: 'generation_failed',
        diagnosticClaim: authority,
      })
      return { handled: true, retryAt: null }
    }

    if (abortSignal.aborted)
      return { handled: true, retryAt: null }
    if (!retained) {
      await classroom.execute({
        type: 'record_remediation_diagnostic_failure',
        failedAttemptId: job.failedAttemptId,
        diagnosticAttempt: job.diagnosticAttempt,
        failure: 'retention_not_completed',
        diagnosticClaim: authority,
      })
    }
    return { handled: true, retryAt: null }
  }
  finally {
    try {
      await classroom.execute({
        type: 'release_remediation_diagnostic_claim',
        job,
        ownerNonce,
      })
    }
    catch {
      // If the aggregate is already disposed, ownership remains durable. Time
      // alone cannot prove that an arbitrary provider request has settled, so
      // recovery requires the learner's explicit acknowledgement in Review.
    }
  }
}
