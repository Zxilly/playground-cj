import { getDefaultCourseContentIndex } from '@/lib/ai/course-content/loader'
import type { ConceptValidationStatus } from '@/lib/ai/course-content/types'
import type { ClassroomSession, ConceptStatus, LearningEvidence, ReviewExposureStatus } from './types'

export interface ConceptProgress {
  unseen: string[]
  seen: string[]
  practicing: string[]
  demonstrated: string[]
  mastered: string[]
  blocked: string[]
  stale: string[]
}

export type ConceptReadiness
  = | 'content_unavailable'
    | 'needs_exposure'
    | 'review_only'
    | 'ready_for_practice'
    | 'needs_practice'
    | 'needs_remediation'
    | 'needs_review_check'
    | 'ready_for_next'

export type ConceptContentStatus = ConceptValidationStatus | 'unavailable'

export interface ConceptProgressEntry {
  conceptId: string
  contentStatus: ConceptContentStatus
  status: ConceptStatus
  evidence: LearningEvidence[]
  exposure: ReviewExposureStatus | 'none'
  readiness: ConceptReadiness
  blockerExplanation: string | null
}

function conceptIdsForSession(session: ClassroomSession): string[] {
  const ids = new Set<string>()
  const track = getDefaultCourseContentIndex().pack.tracks.find(t => t.trackId === session.track.activeTrackId)
  for (const id of track?.conceptIds ?? [])
    ids.add(id)
  for (const evidence of session.learner.evidence) {
    for (const id of evidence.conceptIds)
      ids.add(id)
  }
  for (const exposure of Object.values(session.learner.reviewExposures))
    ids.add(exposure.conceptId)
  for (const artifact of session.learner.reviewArtifacts)
    ids.add(artifact.conceptId)
  return [...ids]
}

function activeTrackConceptOrder(session: ClassroomSession): ReadonlyMap<string, number> {
  const track = getDefaultCourseContentIndex().pack.tracks.find(t => t.trackId === session.track.activeTrackId)
  return new Map(track?.conceptIds.map((conceptId, index) => [conceptId, index]) ?? [])
}

function compareConceptIdsByTrackOrder(
  a: string,
  b: string,
  trackConceptOrder: ReadonlyMap<string, number>,
): number {
  return (trackConceptOrder.get(a) ?? Number.MAX_SAFE_INTEGER) - (trackConceptOrder.get(b) ?? Number.MAX_SAFE_INTEGER)
    || a.localeCompare(b)
}

export function exposureForConcept(session: ClassroomSession, conceptId: string): ReviewExposureStatus | 'none' {
  const exposures = Object.values(session.learner.reviewExposures).filter(e => e.conceptId === conceptId)
  if (exposures.some(e => e.status === 'seen'))
    return 'seen'
  if (exposures.some(e => e.status === 'skipped'))
    return 'skipped'
  if (exposures.some(e => e.status === 'unseen'))
    return 'unseen'
  return 'none'
}

function chronologicalEvidence(evidence: LearningEvidence[]): LearningEvidence[] {
  return evidence
    .map((item, index) => ({ item, index }))
    .sort((a, b) => a.item.createdAt - b.item.createdAt || a.index - b.index)
    .map(entry => entry.item)
}

function isProofEvidence(evidence: LearningEvidence): boolean {
  return evidence.outcome === 'success'
    && (evidence.strength === 'independent' || evidence.strength === 'aided' || evidence.strength === 'mastery')
}

function latestProofIndex(evidence: LearningEvidence[]): number {
  for (let i = evidence.length - 1; i >= 0; i--) {
    if (isProofEvidence(evidence[i]))
      return i
  }
  return -1
}

function latestStaleIndex(evidence: LearningEvidence[]): number {
  for (let i = evidence.length - 1; i >= 0; i--) {
    if (evidence[i].strength === 'stale')
      return i
  }
  return -1
}

function evidenceAfterLatestProof(evidence: LearningEvidence[]): LearningEvidence[] {
  const ordered = chronologicalEvidence(evidence)
  return ordered.slice(latestProofIndex(ordered) + 1)
}

function currentLearningWindow(evidence: LearningEvidence[]): LearningEvidence[] {
  const unresolved = evidenceAfterLatestProof(evidence)
  const staleIndex = latestStaleIndex(unresolved)
  return staleIndex >= 0 ? unresolved.slice(staleIndex + 1) : unresolved
}

function unresolvedFailures(evidence: LearningEvidence[]): LearningEvidence[] {
  return currentLearningWindow(evidence).filter(item => item.outcome === 'failure')
}

function unresolvedSkips(evidence: LearningEvidence[]): LearningEvidence[] {
  return currentLearningWindow(evidence).filter(item => item.outcome === 'skip')
}

export function statusForConcept(evidence: LearningEvidence[], exposure: ReviewExposureStatus | 'none'): ConceptStatus {
  const ordered = chronologicalEvidence(evidence)
  const proofIndex = latestProofIndex(ordered)
  const latestProof = proofIndex >= 0 ? ordered[proofIndex] : null
  const unresolved = ordered.slice(proofIndex + 1)
  const proofsSinceLatestStale = ordered.slice(latestStaleIndex(ordered) + 1).filter(isProofEvidence)
  const unresolvedStaleIndex = latestStaleIndex(unresolved)
  const hasUnresolvedStale = unresolvedStaleIndex >= 0
  const failuresAfterLatestStale = unresolvedFailures(ordered)

  if (hasUnresolvedStale && failuresAfterLatestStale.length >= 2)
    return 'blocked'
  if (hasUnresolvedStale)
    return 'stale'
  if (unresolved.filter(e => e.outcome === 'failure').length >= 2)
    return 'blocked'
  if (proofsSinceLatestStale.some(e => e.strength === 'mastery'))
    return 'mastered'
  if (latestProof)
    return 'demonstrated'
  if (ordered.some(e => e.outcome === 'failure' || e.outcome === 'skip' || e.outcome === 'self_report'))
    return 'practicing'
  if (exposure === 'seen' || exposure === 'skipped')
    return 'seen'
  return 'unseen'
}

function contentStatusForConcept(conceptId: string): ConceptContentStatus {
  return getDefaultCourseContentIndex().validation.conceptStatuses[conceptId] ?? 'unavailable'
}

export function readinessForStatus(status: ConceptStatus, contentStatus: ConceptContentStatus = 'validated'): ConceptReadiness {
  if (contentStatus === 'invalid' || contentStatus === 'unavailable')
    return 'content_unavailable'
  if (contentStatus === 'read_only')
    return 'review_only'
  if (status === 'blocked')
    return 'needs_remediation'
  if (status === 'stale')
    return 'needs_review_check'
  if (status === 'practicing')
    return 'needs_practice'
  if (status === 'seen')
    return 'ready_for_practice'
  if (status === 'demonstrated' || status === 'mastered')
    return 'ready_for_next'
  return 'needs_exposure'
}

export function blockerExplanationForEvidence(evidence: LearningEvidence[], lang: string): string | null {
  const failures = unresolvedFailures(evidence)
  if (failures.length < 2)
    return null

  return lang === 'en'
    ? `This exercise has not passed after ${failures.length} attempts. Review the related hint before trying again.`
    : `这项练习已连续 ${failures.length} 次未通过，建议先看相关提示再试一次。`
}

export function deriveConceptProgressEntries(session: ClassroomSession): ConceptProgressEntry[] {
  const trackConceptOrder = activeTrackConceptOrder(session)
  return conceptIdsForSession(session).map((conceptId) => {
    const evidence = session.learner.evidence.filter(e => e.conceptIds.includes(conceptId))
    const exposure = exposureForConcept(session, conceptId)
    const status = statusForConcept(evidence, exposure)
    const contentStatus = contentStatusForConcept(conceptId)
    return {
      conceptId,
      contentStatus,
      status,
      evidence,
      exposure,
      readiness: readinessForStatus(status, contentStatus),
      blockerExplanation: status === 'blocked' ? blockerExplanationForEvidence(evidence, session.lang) : null,
    }
  }).sort((a, b) => compareConceptIdsByTrackOrder(a.conceptId, b.conceptId, trackConceptOrder))
}

export function deriveConceptProgress(session: ClassroomSession): ConceptProgress {
  const progress: ConceptProgress = {
    unseen: [],
    seen: [],
    practicing: [],
    demonstrated: [],
    mastered: [],
    blocked: [],
    stale: [],
  }

  for (const entry of deriveConceptProgressEntries(session))
    progress[entry.status].push(entry.conceptId)

  return progress
}

export function deriveDemonstratedConceptSet(session: ClassroomSession): Set<string> {
  return new Set(deriveConceptProgressEntries(session)
    .filter(concept => concept.status === 'demonstrated' || concept.status === 'mastered')
    .map(concept => concept.conceptId))
}

export function deriveSkippedConceptCounts(session: ClassroomSession): Map<string, number> {
  const evidenceByConcept = new Map<string, LearningEvidence[]>()
  for (const evidence of session.learner.evidence) {
    for (const conceptId of evidence.conceptIds) {
      const entries = evidenceByConcept.get(conceptId) ?? []
      entries.push(evidence)
      evidenceByConcept.set(conceptId, entries)
    }
  }

  const counts = new Map<string, number>()
  for (const [conceptId, evidence] of evidenceByConcept) {
    const skipCount = unresolvedSkips(evidence).length
    if (skipCount === 0)
      continue
    counts.set(conceptId, skipCount)
  }
  return counts
}
