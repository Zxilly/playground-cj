import type { ContentPackCatalog } from './content-catalog'
import type {
  ClassroomSnapshot,
  ExerciseInstance,
  LearningEvidence,
  LearningTrack,
  TrackAdjustment,
} from './state'
import { deriveConceptProgress } from './progress'

export type TrackConceptUse = 'mainline' | 'placement'

export interface AccelerateTrackCandidate {
  type: 'accelerate'
  conceptId: string
  placementEvidenceId: string
}

export interface FocusedCatchUpTrackCandidate {
  type: 'focused_catch_up'
  conceptId: string
  failureEvidenceId: string
}

export interface ReviewTrackCandidate {
  type: 'review'
  conceptId: string
  encounteredStreamEntryId: string
}

export interface DelayTrackCandidate {
  type: 'delay'
  conceptId: string
  nextConceptId: string
  blockedEvidenceIds: [string, string, string]
}

export interface TrackAdjustmentCandidates {
  accelerate: AccelerateTrackCandidate[]
  focusedCatchUp: FocusedCatchUpTrackCandidate[]
  review: ReviewTrackCandidate[]
  delay: DelayTrackCandidate | null
}

export interface TrackPolicyState {
  pacingAnchorConceptId: string | null
  frontierConceptId: string | null
  encounteredConceptIds: string[]
  adjustmentTargetConceptId: string | null
  adjustmentCandidates: TrackAdjustmentCandidates
}

function attemptsBefore(
  snapshot: ClassroomSnapshot,
  beforeRevision: number,
): Map<string, number> {
  return new Map(snapshot.attempts
    .filter(attempt => attempt.recordedRevision < beforeRevision)
    .map(attempt => [attempt.id, attempt.recordedRevision]))
}

function evidenceBefore(
  snapshot: ClassroomSnapshot,
  beforeRevision: number,
): LearningEvidence[] {
  const attemptRevisions = attemptsBefore(snapshot, beforeRevision)
  return snapshot.evidence.filter(item =>
    item.attemptId !== undefined && attemptRevisions.has(item.attemptId))
}

function progressSnapshot(
  snapshot: ClassroomSnapshot,
  beforeRevision: number,
): ClassroomSnapshot {
  const attempts = snapshot.attempts.filter(
    attempt => attempt.recordedRevision < beforeRevision,
  )
  const attemptIds = new Set(attempts.map(attempt => attempt.id))
  return {
    ...snapshot,
    stream: snapshot.stream.filter(entry => entry.recordedRevision < beforeRevision),
    assistanceEvents: snapshot.assistanceEvents.filter(
      event => event.recordedRevision < beforeRevision,
    ),
    attempts,
    evidence: snapshot.evidence.filter(item =>
      item.attemptId !== undefined && attemptIds.has(item.attemptId)),
  }
}

function pacingProgressSnapshot(
  snapshot: ClassroomSnapshot,
  track: LearningTrack,
  beforeRevision: number,
): ClassroomSnapshot {
  const visible = progressSnapshot(snapshot, beforeRevision)
  const consumedPlacementEvidence = new Set(track.adjustments
    .filter((adjustment): adjustment is Extract<
      TrackAdjustment,
      { type: 'accelerate' }
    > =>
      adjustment.type === 'accelerate'
      && adjustment.recordedRevision < beforeRevision)
    .map(adjustment => adjustment.placementEvidenceId))
  const placementInstances = new Set(visible.stream
    .filter((entry): entry is ExerciseInstance =>
      entry.type === 'exercise_instance' && entry.purpose === 'placement')
    .map(instance => instance.id))
  return {
    ...visible,
    evidence: visible.evidence.filter(item =>
      !item.exerciseInstanceId
      || !placementInstances.has(item.exerciseInstanceId)
      || consumedPlacementEvidence.has(item.id)),
  }
}

function exactTrackPack(
  track: LearningTrack,
  conceptId: string,
  catalog: ContentPackCatalog,
) {
  if (!track.conceptIds.includes(conceptId))
    throw new Error(`${conceptId} is outside Learning Track ${track.id}`)
  const version = track.contentVersions[conceptId]
  if (!version)
    throw new Error(`Learning Track ${track.id} has no Content Version for ${conceptId}`)
  return catalog.requireValidatedVersion(conceptId, version)
}

/**
 * Track pacing and learner-facing Concept Progress answer different questions.
 * Any current, successful, observable work can complete a key skill for
 * supported pacing, while only Independent Evidence can produce demonstrated
 * progress. A currently blocked Concept is never pacing-complete.
 */
function isPacingComplete(
  snapshot: ClassroomSnapshot,
  track: LearningTrack,
  conceptId: string,
  catalog: ContentPackCatalog,
  beforeRevision: number,
): boolean {
  const visible = pacingProgressSnapshot(snapshot, track, beforeRevision)
  const pack = exactTrackPack(track, conceptId, catalog)
  if (deriveConceptProgress(visible, pack) === 'blocked')
    return false
  const keySkills = pack.learningSkills.filter(skill => skill.key)
  const skills = keySkills.length > 0 ? keySkills : pack.learningSkills
  return skills.length > 0 && skills.every(skill =>
    visible.evidence.some(item =>
      item.conceptId === conceptId
      && item.learningContractVersion === pack.learningContractVersion
      && item.learningSkillId === skill.id
      && item.outcome === 'success'))
}

function encounteredEntry(
  snapshot: ClassroomSnapshot,
  track: LearningTrack,
  conceptId: string,
  beforeRevision: number,
) {
  return snapshot.stream.find(entry =>
    entry.learningTrackId === track.id
    && entry.conceptId === conceptId
    && entry.recordedRevision < beforeRevision
    && (
      entry.type === 'content_reference_group'
      || entry.type === 'bridge_note'
      || entry.type === 'skip_marker'
      || (entry.type === 'exercise_instance' && entry.purpose !== 'placement')
    ))
}

export function isConceptEncountered(
  snapshot: ClassroomSnapshot,
  track: LearningTrack,
  conceptId: string,
  beforeRevision = snapshot.revision + 1,
): boolean {
  return encounteredEntry(snapshot, track, conceptId, beforeRevision) !== undefined
}

function pacingAnchorConceptId(
  track: LearningTrack,
  beforeRevision: number,
): string | null {
  const adjustment = track.adjustments
    .filter(item =>
      item.recordedRevision < beforeRevision
      && (item.type === 'accelerate' || item.type === 'delay'))
    .at(-1)
  if (!adjustment)
    return track.conceptIds[0] ?? null
  return adjustment.type === 'delay'
    ? adjustment.nextConceptId
    : adjustment.conceptId
}

function frontierConceptId(
  snapshot: ClassroomSnapshot,
  track: LearningTrack,
  catalog: ContentPackCatalog,
  beforeRevision: number,
): string | null {
  const anchor = pacingAnchorConceptId(track, beforeRevision)
  const anchorIndex = anchor === null ? 0 : track.conceptIds.indexOf(anchor)
  if (anchorIndex < 0)
    throw new Error(`Learning Track ${track.id} has an invalid pacing anchor ${anchor}`)
  return track.conceptIds.slice(anchorIndex).find(conceptId =>
    !isPacingComplete(snapshot, track, conceptId, catalog, beforeRevision)) ?? null
}

/** Derive only the pacing frontier without materializing capability candidates. */
export function deriveTrackPacingFrontier(
  snapshot: ClassroomSnapshot,
  track: LearningTrack,
  catalog: ContentPackCatalog,
  beforeRevision = snapshot.revision + 1,
): string | null {
  return frontierConceptId(snapshot, track, catalog, beforeRevision)
}

function adjustmentTarget(
  track: LearningTrack,
  beforeRevision: number,
): string | null {
  const adjustment = track.adjustments
    .filter(item => item.recordedRevision < beforeRevision)
    .at(-1)
  if (!adjustment)
    return null
  return adjustment.type === 'delay'
    ? adjustment.nextConceptId
    : adjustment.conceptId
}

function placementAdjustmentCandidates(
  snapshot: ClassroomSnapshot,
  track: LearningTrack,
  catalog: ContentPackCatalog,
  beforeRevision: number,
  frontier: string | null,
): Pick<TrackAdjustmentCandidates, 'accelerate' | 'focusedCatchUp'> {
  const frontierIndex = frontier === null
    ? -1
    : track.conceptIds.indexOf(frontier)
  const attempts = new Map(snapshot.attempts
    .filter(attempt => attempt.recordedRevision < beforeRevision)
    .map(attempt => [attempt.id, attempt]))
  const instances = new Map(snapshot.stream
    .filter((entry): entry is ExerciseInstance =>
      entry.type === 'exercise_instance'
      && entry.recordedRevision < beforeRevision)
    .map(instance => [instance.id, instance]))
  const contractVersions = new Map(track.conceptIds.map(conceptId => [
    conceptId,
    exactTrackPack(track, conceptId, catalog).learningContractVersion,
  ]))
  const consumedAcceleration = new Set(track.adjustments
    .filter((adjustment): adjustment is Extract<
      TrackAdjustment,
      { type: 'accelerate' }
    > =>
      adjustment.type === 'accelerate'
      && adjustment.recordedRevision < beforeRevision)
    .map(adjustment => adjustment.placementEvidenceId))
  const consumedCatchUp = new Set(track.adjustments
    .filter((adjustment): adjustment is Extract<
      TrackAdjustment,
      { type: 'focused_catch_up' }
    > =>
      adjustment.type === 'focused_catch_up'
      && adjustment.recordedRevision < beforeRevision)
    .map(adjustment => adjustment.failureEvidenceId))
  const accelerate = new Map<
    string,
    AccelerateTrackCandidate & { attemptRevision: number }
  >()
  const focusedCatchUp = new Map<
    string,
    FocusedCatchUpTrackCandidate & { attemptRevision: number }
  >()

  for (const evidence of evidenceBefore(snapshot, beforeRevision)) {
    if (!evidence.attemptId)
      continue
    const attempt = attempts.get(evidence.attemptId)
    const instance = evidence.exerciseInstanceId
      ? instances.get(evidence.exerciseInstanceId)
      : undefined
    if (
      !attempt
      || !instance
      || attempt.exerciseInstanceId !== instance.id
      || instance.purpose !== 'placement'
      || instance.learningTrackId !== track.id
      || !track.conceptIds.includes(evidence.conceptId)
      || evidence.conceptId !== instance.conceptId
      || evidence.learningSkillId !== instance.learningSkillId
      || evidence.learningContractVersion
      !== contractVersions.get(evidence.conceptId)
    ) {
      continue
    }
    const attemptRevision = attempt.recordedRevision

    if (
      frontierIndex >= 0
      && track.conceptIds.indexOf(evidence.conceptId) >= frontierIndex
      && evidence.outcome === 'success'
      && evidence.type === 'independent'
      && !consumedAcceleration.has(evidence.id)
    ) {
      const previous = accelerate.get(evidence.conceptId)
      if (!previous || previous.attemptRevision < attemptRevision) {
        accelerate.set(evidence.conceptId, {
          type: 'accelerate',
          conceptId: evidence.conceptId,
          placementEvidenceId: evidence.id,
          attemptRevision,
        })
      }
    }

    if (
      evidence.outcome === 'failure'
      && !consumedCatchUp.has(evidence.id)
    ) {
      const previous = focusedCatchUp.get(evidence.conceptId)
      if (!previous || previous.attemptRevision < attemptRevision) {
        focusedCatchUp.set(evidence.conceptId, {
          type: 'focused_catch_up',
          conceptId: evidence.conceptId,
          failureEvidenceId: evidence.id,
          attemptRevision,
        })
      }
    }
  }

  return {
    accelerate: track.conceptIds.flatMap((conceptId) => {
      const candidate = accelerate.get(conceptId)
      return candidate
        ? [{
            type: candidate.type,
            conceptId: candidate.conceptId,
            placementEvidenceId: candidate.placementEvidenceId,
          }]
        : []
    }),
    focusedCatchUp: track.conceptIds.flatMap((conceptId) => {
      const candidate = focusedCatchUp.get(conceptId)
      return candidate
        ? [{
            type: candidate.type,
            conceptId: candidate.conceptId,
            failureEvidenceId: candidate.failureEvidenceId,
          }]
        : []
    }),
  }
}

function reviewAdjustmentCandidates(
  snapshot: ClassroomSnapshot,
  track: LearningTrack,
  beforeRevision: number,
): ReviewTrackCandidate[] {
  const trackConcepts = new Set(track.conceptIds)
  const consumedEntries = new Set(track.adjustments
    .filter((adjustment): adjustment is Extract<
      TrackAdjustment,
      { type: 'review' }
    > =>
      adjustment.type === 'review'
      && adjustment.recordedRevision < beforeRevision)
    .map(adjustment => adjustment.encounteredStreamEntryId))
  const latestByConcept = new Map<string, ClassroomSnapshot['stream'][number]>()
  for (const candidate of snapshot.stream) {
    if (
      consumedEntries.has(candidate.id)
      || candidate.learningTrackId !== track.id
      || !trackConcepts.has(candidate.conceptId)
      || candidate.recordedRevision >= beforeRevision
      || (
        candidate.type !== 'content_reference_group'
        && candidate.type !== 'bridge_note'
        && candidate.type !== 'skip_marker'
        && (
          candidate.type !== 'exercise_instance'
          || candidate.purpose === 'placement'
        )
      )
    ) {
      continue
    }
    latestByConcept.set(candidate.conceptId, candidate)
  }
  return track.conceptIds.flatMap((conceptId) => {
    const entry = latestByConcept.get(conceptId)
    return entry
      ? [{
          type: 'review',
          conceptId,
          encounteredStreamEntryId: entry.id,
        }]
      : []
  })
}

function delayAdjustmentCandidate(
  snapshot: ClassroomSnapshot,
  track: LearningTrack,
  catalog: ContentPackCatalog,
  beforeRevision: number,
  frontier: string | null,
): DelayTrackCandidate | null {
  if (frontier === null)
    return null
  const pack = exactTrackPack(track, frontier, catalog)
  if (deriveConceptProgress(progressSnapshot(snapshot, beforeRevision), pack) !== 'blocked')
    return null
  const blockedEvidenceIds = blockingEvidenceIds(
    snapshot,
    track,
    frontier,
    catalog,
    beforeRevision,
  )
  const nextConceptId = nextDelayTarget(
    snapshot,
    track,
    frontier,
    catalog,
    beforeRevision,
  )
  if (blockedEvidenceIds.length !== 3 || nextConceptId === null)
    return null
  return {
    type: 'delay',
    conceptId: frontier,
    nextConceptId,
    blockedEvidenceIds: blockedEvidenceIds as [string, string, string],
  }
}

export function deriveTrackPolicyState(
  snapshot: ClassroomSnapshot,
  track: LearningTrack,
  catalog: ContentPackCatalog,
  beforeRevision = snapshot.revision + 1,
): TrackPolicyState {
  const frontier = frontierConceptId(
    snapshot,
    track,
    catalog,
    beforeRevision,
  )
  const placementCandidates = placementAdjustmentCandidates(
    snapshot,
    track,
    catalog,
    beforeRevision,
    frontier,
  )
  return {
    pacingAnchorConceptId: pacingAnchorConceptId(track, beforeRevision),
    frontierConceptId: frontier,
    encounteredConceptIds: track.conceptIds.filter(conceptId =>
      isConceptEncountered(snapshot, track, conceptId, beforeRevision)),
    adjustmentTargetConceptId: adjustmentTarget(track, beforeRevision),
    adjustmentCandidates: {
      ...placementCandidates,
      review: reviewAdjustmentCandidates(snapshot, track, beforeRevision),
      delay: delayAdjustmentCandidate(
        snapshot,
        track,
        catalog,
        beforeRevision,
        frontier,
      ),
    },
  }
}

/**
 * Mainline writes are confined to the derived frontier, previously encountered
 * Concepts, or the exact target of the latest evidence-backed adjustment.
 * A future Concept can be probed only through an authored Placement template.
 */
export function assertTrackConceptAccess(
  snapshot: ClassroomSnapshot,
  track: LearningTrack,
  conceptId: string,
  use: TrackConceptUse,
  catalog: ContentPackCatalog,
  beforeRevision = snapshot.revision + 1,
): void {
  exactTrackPack(track, conceptId, catalog)
  const frontier = frontierConceptId(
    snapshot,
    track,
    catalog,
    beforeRevision,
  )
  if (
    frontier === conceptId
    || isConceptEncountered(snapshot, track, conceptId, beforeRevision)
    || adjustmentTarget(track, beforeRevision) === conceptId
  ) {
    return
  }
  if (use === 'placement')
    return
  throw new Error(
    `${conceptId} is not the current Learning Track frontier, an encountered Concept, `
    + 'or the target of an evidence-backed Track Adjustment',
  )
}

function requireEvidence(
  snapshot: ClassroomSnapshot,
  evidenceId: string,
  beforeRevision: number,
): LearningEvidence {
  const evidence = evidenceBefore(snapshot, beforeRevision)
    .find(item => item.id === evidenceId)
  if (!evidence)
    throw new Error(`Track Adjustment references unavailable Learning Evidence ${evidenceId}`)
  return evidence
}

function requireEvidenceInstance(
  snapshot: ClassroomSnapshot,
  evidence: LearningEvidence,
  beforeRevision: number,
): ExerciseInstance {
  const attempt = snapshot.attempts.find(item =>
    item.id === evidence.attemptId
    && item.recordedRevision < beforeRevision)
  const instance = snapshot.stream.find((entry): entry is ExerciseInstance =>
    entry.type === 'exercise_instance'
    && entry.id === evidence.exerciseInstanceId
    && entry.recordedRevision < beforeRevision)
  if (!attempt || !instance || attempt.exerciseInstanceId !== instance.id) {
    throw new Error(
      `Track Adjustment Learning Evidence ${evidence.id} lacks an earlier Exercise Attempt`,
    )
  }
  return instance
}

function blockingEvidenceIds(
  snapshot: ClassroomSnapshot,
  track: LearningTrack,
  conceptId: string,
  catalog: ContentPackCatalog,
  beforeRevision: number,
): string[] {
  const pack = exactTrackPack(track, conceptId, catalog)
  const keySkills = pack.learningSkills.filter(skill => skill.key)
  const skills = keySkills.length > 0 ? keySkills : pack.learningSkills
  const attemptRevision = attemptsBefore(snapshot, beforeRevision)
  const evidence = evidenceBefore(snapshot, beforeRevision)

  for (const skill of skills) {
    const ordered = evidence
      .filter(item =>
        item.conceptId === conceptId
        && item.learningContractVersion === pack.learningContractVersion
        && item.learningSkillId === skill.id)
      .sort((left, right) => {
        const leftRevision = left.attemptId
          ? attemptRevision.get(left.attemptId) ?? Number.MAX_SAFE_INTEGER
          : Number.MAX_SAFE_INTEGER
        const rightRevision = right.attemptId
          ? attemptRevision.get(right.attemptId) ?? Number.MAX_SAFE_INTEGER
          : Number.MAX_SAFE_INTEGER
        return leftRevision - rightRevision
      })
    let failures: string[] = []
    for (const item of ordered) {
      failures = item.outcome === 'failure'
        ? [...failures, item.id]
        : []
    }
    if (failures.length >= 3)
      return failures.slice(-3)
  }
  return []
}

function nextDelayTarget(
  snapshot: ClassroomSnapshot,
  track: LearningTrack,
  blockedConceptId: string,
  catalog: ContentPackCatalog,
  beforeRevision: number,
): string | null {
  const start = track.conceptIds.indexOf(blockedConceptId)
  for (const conceptId of track.conceptIds.slice(start + 1)) {
    if (isPacingComplete(snapshot, track, conceptId, catalog, beforeRevision))
      continue
    const pack = exactTrackPack(track, conceptId, catalog)
    const prerequisitesReady = pack.concept.prerequisites.every(prerequisite =>
      isPacingComplete(snapshot, track, prerequisite, catalog, beforeRevision))
    if (prerequisitesReady)
      return conceptId
  }
  return null
}

/** Revalidate the evidence and target constraints of one persisted adjustment. */
export function assertTrackAdjustment(
  snapshot: ClassroomSnapshot,
  track: LearningTrack,
  adjustment: TrackAdjustment,
  catalog: ContentPackCatalog,
): void {
  const beforeRevision = adjustment.recordedRevision
  const targetPack = exactTrackPack(track, adjustment.conceptId, catalog)

  if (adjustment.type === 'accelerate') {
    const frontier = frontierConceptId(
      snapshot,
      track,
      catalog,
      beforeRevision,
    )
    const frontierIndex = frontier === null
      ? -1
      : track.conceptIds.indexOf(frontier)
    const targetIndex = track.conceptIds.indexOf(adjustment.conceptId)
    if (frontierIndex < 0 || targetIndex < frontierIndex) {
      throw new Error(
        `Accelerate Track Adjustment target ${adjustment.conceptId} precedes the frontier`,
      )
    }
    const evidence = requireEvidence(
      snapshot,
      adjustment.placementEvidenceId,
      beforeRevision,
    )
    const instance = requireEvidenceInstance(snapshot, evidence, beforeRevision)
    if (
      evidence.conceptId !== adjustment.conceptId
      || evidence.learningContractVersion !== targetPack.learningContractVersion
      || evidence.outcome !== 'success'
      || evidence.type !== 'independent'
      || instance.purpose !== 'placement'
      || instance.learningTrackId !== track.id
    ) {
      throw new Error(
        'Accelerate Track Adjustment requires successful independent Placement Evidence '
        + `for ${adjustment.conceptId}`,
      )
    }
    return
  }

  if (adjustment.type === 'focused_catch_up') {
    const evidence = requireEvidence(
      snapshot,
      adjustment.failureEvidenceId,
      beforeRevision,
    )
    const instance = requireEvidenceInstance(snapshot, evidence, beforeRevision)
    if (
      evidence.conceptId !== adjustment.conceptId
      || evidence.learningContractVersion !== targetPack.learningContractVersion
      || evidence.outcome !== 'failure'
      || instance.purpose !== 'placement'
      || instance.learningTrackId !== track.id
    ) {
      throw new Error(
        `Focused Catch-Up requires failed Placement Evidence for ${adjustment.conceptId}`,
      )
    }
    return
  }

  if (adjustment.type === 'review') {
    const entry = snapshot.stream.find(item =>
      item.id === adjustment.encounteredStreamEntryId
      && item.recordedRevision < beforeRevision)
    if (
      !entry
      || entry.learningTrackId !== track.id
      || entry.conceptId !== adjustment.conceptId
      || !isConceptEncountered(
        {
          ...snapshot,
          stream: [entry],
        },
        track,
        adjustment.conceptId,
        beforeRevision,
      )
    ) {
      throw new Error(
        `Review Track Adjustment requires an earlier encounter with ${adjustment.conceptId}`,
      )
    }
    return
  }

  const frontier = frontierConceptId(
    snapshot,
    track,
    catalog,
    beforeRevision,
  )
  if (frontier !== adjustment.conceptId) {
    throw new Error(
      `Delay Track Adjustment can delay only the current frontier ${frontier ?? '(none)'}`,
    )
  }
  const pack = exactTrackPack(track, adjustment.conceptId, catalog)
  if (deriveConceptProgress(progressSnapshot(snapshot, beforeRevision), pack) !== 'blocked') {
    throw new Error(
      `Delay Track Adjustment requires blocked progress for ${adjustment.conceptId}`,
    )
  }
  const expectedEvidenceIds = blockingEvidenceIds(
    snapshot,
    track,
    adjustment.conceptId,
    catalog,
    beforeRevision,
  )
  if (
    expectedEvidenceIds.length < 3
    || expectedEvidenceIds.length !== adjustment.blockedEvidenceIds.length
    || expectedEvidenceIds.some((id, index) => adjustment.blockedEvidenceIds[index] !== id)
  ) {
    throw new Error('Delay Track Adjustment must cite the current consecutive failure Evidence')
  }
  const expectedNext = nextDelayTarget(
    snapshot,
    track,
    adjustment.conceptId,
    catalog,
    beforeRevision,
  )
  if (!expectedNext || adjustment.nextConceptId !== expectedNext) {
    throw new Error(
      `Delay Track Adjustment must select the next eligible target ${expectedNext ?? '(none)'}`,
    )
  }
}
