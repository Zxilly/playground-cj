import type { ContentPackCatalog } from './content-catalog'
import type { CourseContentPack } from './content-packs'
import type {
  ClassroomSnapshot,
  ExerciseInstance,
  LearningEvidence,
  LearningTrack,
  SkipMarkerBasis,
  TrackAdjustment,
} from './state'
import { deriveTrackPacingFrontier } from './track-policy'

export interface SkipMarkerBasisCandidate {
  conceptId: string
  basis: SkipMarkerBasis
}

function exactTrackPack(
  track: LearningTrack,
  conceptId: string,
  catalog: ContentPackCatalog,
): CourseContentPack {
  if (!track.conceptIds.includes(conceptId))
    throw new Error(`${conceptId} is outside Learning Track ${track.id}`)
  const contentVersion = track.contentVersions[conceptId]
  if (!contentVersion) {
    throw new Error(
      `Learning Track ${track.id} has no Content Version for ${conceptId}`,
    )
  }
  return catalog.requireValidatedVersion(conceptId, contentVersion)
}

interface IndexedEvidence {
  evidence: LearningEvidence
  attemptRevision: number
  instance: ExerciseInstance | null
  ordinal: number
}

interface SkipEvidenceIndex {
  blockedSkills: Set<string>
  successfulNonPlacement: Map<string, IndexedEvidence>
}

function evidenceKey(
  conceptId: string,
  learningContractVersion: string,
  learningSkillId: string,
): string {
  return JSON.stringify([
    conceptId,
    learningContractVersion,
    learningSkillId,
  ])
}

function createSkipEvidenceIndex(
  snapshot: ClassroomSnapshot,
  beforeRevision: number,
): SkipEvidenceIndex {
  const attempts = new Map(snapshot.attempts
    .filter(attempt => attempt.recordedRevision < beforeRevision)
    .map(attempt => [attempt.id, attempt]))
  const instances = new Map(snapshot.stream
    .filter((entry): entry is ExerciseInstance =>
      entry.type === 'exercise_instance'
      && entry.recordedRevision < beforeRevision)
    .map(instance => [instance.id, instance]))

  const observable = snapshot.evidence.flatMap((evidence, ordinal) => {
    if (!evidence.attemptId)
      return []
    const attempt = attempts.get(evidence.attemptId)
    if (!attempt)
      return []
    const instance = evidence.exerciseInstanceId
      ? instances.get(evidence.exerciseInstanceId) ?? null
      : null
    return [{
      evidence,
      attemptRevision: attempt.recordedRevision,
      instance: instance?.id === attempt.exerciseInstanceId ? instance : null,
      ordinal,
    }]
  })

  const consecutiveFailures = new Map<string, number>()
  for (const { evidence } of [...observable].sort((left, right) =>
    left.attemptRevision - right.attemptRevision
    || left.ordinal - right.ordinal)) {
    const key = evidenceKey(
      evidence.conceptId,
      evidence.learningContractVersion,
      evidence.learningSkillId,
    )
    consecutiveFailures.set(
      key,
      evidence.outcome === 'success'
        ? 0
        : (consecutiveFailures.get(key) ?? 0) + 1,
    )
  }
  const blockedSkills = new Set([...consecutiveFailures]
    .filter(([, count]) => count >= 3)
    .map(([key]) => key))

  const successfulNonPlacement = new Map<string, IndexedEvidence>()
  for (const candidate of observable) {
    const { evidence, instance } = candidate
    if (evidence.outcome !== 'success' || !instance || instance.purpose === 'placement')
      continue
    const key = evidenceKey(
      evidence.conceptId,
      evidence.learningContractVersion,
      evidence.learningSkillId,
    )
    const previous = successfulNonPlacement.get(key)
    if (
      !previous
      || candidate.attemptRevision > previous.attemptRevision
      || (
        candidate.attemptRevision === previous.attemptRevision
        && (
          evidence.createdAt > previous.evidence.createdAt
          || (
            evidence.createdAt === previous.evidence.createdAt
            && evidence.id.localeCompare(previous.evidence.id) > 0
          )
        )
      )
    ) {
      successfulNonPlacement.set(key, candidate)
    }
  }
  return {
    blockedSkills,
    successfulNonPlacement,
  }
}

function requiredSkills(pack: CourseContentPack) {
  const keySkills = pack.learningSkills.filter(skill => skill.key)
  return keySkills.length > 0 ? keySkills : pack.learningSkills
}

function isBlocked(
  index: SkipEvidenceIndex,
  pack: CourseContentPack,
): boolean {
  return requiredSkills(pack).some(skill => index.blockedSkills.has(
    evidenceKey(
      pack.concept.id,
      pack.learningContractVersion,
      skill.id,
    ),
  ))
}

function deriveSuccessfulEvidenceSkipBasisFromIndex(
  index: SkipEvidenceIndex,
  pack: CourseContentPack,
): Extract<SkipMarkerBasis, { type: 'successful_evidence' }> | null {
  const skills = requiredSkills(pack)
  if (skills.length === 0 || isBlocked(index, pack))
    return null
  const evidenceIds: string[] = []
  for (const skill of skills) {
    const witness = index.successfulNonPlacement.get(evidenceKey(
      pack.concept.id,
      pack.learningContractVersion,
      skill.id,
    ))
    if (!witness)
      return null
    evidenceIds.push(witness.evidence.id)
  }
  return {
    type: 'successful_evidence',
    evidenceIds,
  }
}

function eligibleTrackAdjustment(
  track: LearningTrack,
  conceptId: string,
  beforeRevision: number,
): Extract<TrackAdjustment, { type: 'accelerate' | 'delay' }> | null {
  const conceptIndex = track.conceptIds.indexOf(conceptId)
  const adjustment = track.adjustments.filter((candidate): candidate is Extract<
    TrackAdjustment,
    { type: 'accelerate' | 'delay' }
  > =>
    candidate.recordedRevision < beforeRevision
    && (
      (
        candidate.type === 'accelerate'
        && track.conceptIds.indexOf(candidate.conceptId) >= conceptIndex
      )
      || (
        candidate.type === 'delay'
        && candidate.conceptId === conceptId
      )
    ))
    .at(-1)
  return adjustment ?? null
}

function applicableTrackAdjustmentsByConcept(
  track: LearningTrack,
  beforeRevision: number,
): Map<string, Extract<TrackAdjustment, { type: 'accelerate' | 'delay' }>> {
  type ApplicableAdjustment = Extract<
    TrackAdjustment,
    { type: 'accelerate' | 'delay' }
  >
  const accelerateAtTarget: Array<ApplicableAdjustment | undefined>
    = Array.from({ length: track.conceptIds.length })
  const delayByConcept = new Map<string, ApplicableAdjustment>()
  for (const adjustment of track.adjustments) {
    if (adjustment.recordedRevision >= beforeRevision)
      continue
    if (adjustment.type === 'accelerate') {
      const targetIndex = track.conceptIds.indexOf(adjustment.conceptId)
      if (targetIndex >= 0)
        accelerateAtTarget[targetIndex] = adjustment
    }
    else if (adjustment.type === 'delay') {
      delayByConcept.set(adjustment.conceptId, adjustment)
    }
  }

  const applicable = new Map<string, ApplicableAdjustment>()
  let latestAcceleration: ApplicableAdjustment | undefined
  for (let index = track.conceptIds.length - 1; index >= 0; index -= 1) {
    const atTarget = accelerateAtTarget[index]
    if (
      atTarget
      && (
        !latestAcceleration
        || atTarget.recordedRevision > latestAcceleration.recordedRevision
      )
    ) {
      latestAcceleration = atTarget
    }
    const conceptId = track.conceptIds[index]
    const delay = delayByConcept.get(conceptId)
    const latest = delay
      && (
        !latestAcceleration
        || delay.recordedRevision > latestAcceleration.recordedRevision
      )
      ? delay
      : latestAcceleration
    if (latest)
      applicable.set(conceptId, latest)
  }
  return applicable
}

function isBeforePacingFrontier(
  track: LearningTrack,
  conceptId: string,
  frontierConceptId: string | null,
): boolean {
  if (frontierConceptId === null)
    return true
  return track.conceptIds.indexOf(conceptId)
    < track.conceptIds.indexOf(frontierConceptId)
}

/** Revalidate one requested Skip Marker basis against the full aggregate. */
export function assertSkipMarkerBasis(
  snapshot: ClassroomSnapshot,
  track: LearningTrack,
  conceptId: string,
  basis: SkipMarkerBasis,
  catalog: ContentPackCatalog,
  beforeRevision = snapshot.revision + 1,
): void {
  const pack = exactTrackPack(track, conceptId, catalog)
  const evidenceIndex = createSkipEvidenceIndex(snapshot, beforeRevision)
  const frontier = deriveTrackPacingFrontier(
    snapshot,
    track,
    catalog,
    beforeRevision,
  )
  if (!isBeforePacingFrontier(track, conceptId, frontier)) {
    throw new Error(
      `Skip Marker Concept ${conceptId} has not passed the Learning Track pacing frontier`,
    )
  }
  if (basis.type === 'track_adjustment') {
    const adjustment = eligibleTrackAdjustment(
      track,
      conceptId,
      beforeRevision,
    )
    if (adjustment?.id !== basis.adjustmentId) {
      throw new Error(
        'Skip Marker requires the exact current applicable Accelerate or Delay Track Adjustment '
        + `for ${conceptId}`,
      )
    }
    return
  }

  const expected = deriveSuccessfulEvidenceSkipBasisFromIndex(
    evidenceIndex,
    pack,
  )
  if (
    !expected
    || expected.evidenceIds.length !== basis.evidenceIds.length
    || expected.evidenceIds.some((id, index) => basis.evidenceIds[index] !== id)
  ) {
    throw new Error(
      'Skip Marker requires the exact current successful Evidence witness '
      + `for every key Learning Skill in ${conceptId}`,
    )
  }
}

/**
 * Full-state projection for the Teacher. At most two candidates are returned
 * per Track Concept: the latest eligible adjustment and the current complete
 * key-skill witness.
 */
export function deriveSkipMarkerBasisCandidates(
  snapshot: ClassroomSnapshot,
  track: LearningTrack,
  catalog: ContentPackCatalog,
  beforeRevision = snapshot.revision + 1,
): SkipMarkerBasisCandidate[] {
  const evidenceIndex = createSkipEvidenceIndex(snapshot, beforeRevision)
  const frontier = deriveTrackPacingFrontier(
    snapshot,
    track,
    catalog,
    beforeRevision,
  )
  const applicableAdjustments = applicableTrackAdjustmentsByConcept(
    track,
    beforeRevision,
  )
  return track.conceptIds.flatMap((conceptId) => {
    if (!isBeforePacingFrontier(track, conceptId, frontier))
      return []
    const pack = exactTrackPack(track, conceptId, catalog)
    const candidates: SkipMarkerBasisCandidate[] = []
    const adjustment = applicableAdjustments.get(conceptId)
    if (adjustment) {
      candidates.push({
        conceptId,
        basis: {
          type: 'track_adjustment',
          adjustmentId: adjustment.id,
        },
      })
    }
    const evidence = deriveSuccessfulEvidenceSkipBasisFromIndex(
      evidenceIndex,
      pack,
    )
    if (evidence)
      candidates.push({ conceptId, basis: evidence })
    return candidates
  })
}
