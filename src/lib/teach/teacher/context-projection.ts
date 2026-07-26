import type { ContentPackCatalog, ContentPackSummary } from '../classroom/content-catalog'
import type {
  ClassroomSnapshot,
  ExerciseInstance,
  LearningTrack,
  ReviewArtifact,
  TrackAdjustment,
} from '../classroom/state'
import type { TeacherChatScope } from './toolkit'
import { createAssessmentHistoryIndex } from '../classroom/assessment-policy'
import { MAX_CONTENT_PACK_ID_LENGTH } from '../classroom/content-packs'
import { deriveConceptProgress } from '../classroom/progress'
import { groupReviewArtifacts } from '../classroom/retention'
import { createRemediationProvenanceIndex } from '../classroom/remediation-provenance'
import { deriveSkipMarkerBasisCandidates } from '../classroom/skip-marker-policy'
import { MAX_LEARNING_TRACK_CONCEPTS } from '../classroom/state'
import { deriveTrackPolicyState } from '../classroom/track-policy'

const CLASSROOM_CONCEPT_LIMIT = 64
const ACTIVE_TRACK_CONCEPT_LIMIT = MAX_LEARNING_TRACK_CONCEPTS
const ACTIVE_TRACK_ADJUSTMENT_LIMIT = 20
const TRACK_ADJUSTMENT_EVIDENCE_LIMIT = 12
const TRACK_POLICY_ENCOUNTERED_LIMIT = 64
const RECENT_ATTEMPT_LIMIT = 12
const RECENT_EVIDENCE_LIMIT = 20
const ACTIVE_EXERCISE_LIMIT = 12
const RETAINED_ARTIFACT_LIMIT = 32
const ARTIFACT_PROVENANCE_ID_LIMIT = 16
const PENDING_REMEDIATION_LIMIT = 8
const RETENTION_SUPPRESSION_LIMIT = 32

function collectionBounds(
  matchedCount: number,
  returnedCount: number,
  limit: number,
  strategy: 'first' | 'page' | 'recent' | 'scope-priority',
) {
  return {
    matchedCount,
    returnedCount,
    limit,
    truncated: returnedCount < matchedCount,
    strategy,
  }
}

function compareIds(left: string, right: string): number {
  if (left === right)
    return 0
  return left < right ? -1 : 1
}

function collectRecentMatching<T>(
  values: readonly T[],
  limit: number,
  matches: (value: T) => boolean,
) {
  const items: T[] = []
  let matchedCount = 0
  for (const value of values) {
    if (!matches(value))
      continue
    matchedCount += 1
    if (items.length === limit)
      items.shift()
    items.push(value)
  }
  return { items, matchedCount }
}

function collectMostRecentMatching<T, S extends T>(
  values: readonly T[],
  limit: number,
  matches: (value: T) => value is S,
  compare: (left: S, right: S) => number,
): { items: S[], matchedCount: number }
function collectMostRecentMatching<T>(
  values: readonly T[],
  limit: number,
  matches: (value: T) => boolean,
  compare: (left: T, right: T) => number,
): { items: T[], matchedCount: number }
function collectMostRecentMatching<T>(
  values: readonly T[],
  limit: number,
  matches: (value: T) => boolean,
  compare: (left: T, right: T) => number,
): { items: T[], matchedCount: number } {
  const items: T[] = []
  let matchedCount = 0
  for (const value of values) {
    if (!matches(value))
      continue
    matchedCount += 1
    if (items.length < limit) {
      items.push(value)
      items.sort(compare)
      continue
    }
    if (compare(value, items[0]) <= 0)
      continue
    items[0] = value
    items.sort(compare)
  }
  return { items, matchedCount }
}

function projectContentPackSummary(summary: ContentPackSummary) {
  const conceptId = summary.conceptId.slice(0, MAX_CONTENT_PACK_ID_LENGTH)
  const title = summary.title.slice(0, 512)
  const version = summary.version.slice(0, 128)
  const truncatedFields = [
    ...(conceptId.length < summary.conceptId.length ? ['conceptId'] : []),
    ...(title.length < summary.title.length ? ['title'] : []),
    ...(version.length < summary.version.length ? ['version'] : []),
  ]
  return {
    conceptId,
    title,
    version,
    availability: summary.availability,
    availabilityReason: summary.availabilityReason,
    truncated: truncatedFields.length > 0,
    truncatedFields,
  }
}

function boundedDiagnosticText(value: string | undefined, maximum: number): string | undefined {
  if (value === undefined || value.length <= maximum)
    return value
  const half = Math.floor(maximum / 2)
  return `${value.slice(0, half)}\n…[bounded diagnostic excerpt]…\n${value.slice(-half)}`
}

function projectTrackAdjustment(adjustment: TrackAdjustment) {
  const base = {
    id: adjustment.id,
    type: adjustment.type,
    conceptId: adjustment.conceptId,
    decision: adjustment.decision,
    createdAt: adjustment.createdAt,
    recordedRevision: adjustment.recordedRevision,
  }
  if (adjustment.type === 'accelerate') {
    return {
      ...base,
      placementEvidenceId: adjustment.placementEvidenceId,
    }
  }
  if (adjustment.type === 'focused_catch_up') {
    return {
      ...base,
      failureEvidenceId: adjustment.failureEvidenceId,
    }
  }
  if (adjustment.type === 'review') {
    return {
      ...base,
      encounteredStreamEntryId: adjustment.encounteredStreamEntryId,
    }
  }
  return {
    ...base,
    nextConceptId: adjustment.nextConceptId,
    blockedEvidenceIds: adjustment.blockedEvidenceIds.slice(
      -TRACK_ADJUSTMENT_EVIDENCE_LIMIT,
    ),
    blockedEvidenceCount: adjustment.blockedEvidenceIds.length,
    blockedEvidenceTruncated:
      adjustment.blockedEvidenceIds.length > TRACK_ADJUSTMENT_EVIDENCE_LIMIT,
  }
}

function projectActiveTrack(
  track: LearningTrack,
  relevantConceptIds: readonly (string | null)[],
) {
  const conceptIds = track.conceptIds.slice(0, ACTIVE_TRACK_CONCEPT_LIMIT)
  const versionConceptIds = [
    ...new Set([
      ...conceptIds,
      ...relevantConceptIds.filter((id): id is string => id !== null),
    ]),
  ]
  const contentVersionEntries: Array<[string, string]> = []
  for (const conceptId of versionConceptIds) {
    const version = track.contentVersions[conceptId]
    if (version !== undefined)
      contentVersionEntries.push([conceptId, version])
  }
  const adjustments = track.adjustments
    .slice(-ACTIVE_TRACK_ADJUSTMENT_LIMIT)
    .map(projectTrackAdjustment)
  return {
    track: {
      id: track.id,
      goal: track.goal,
      conceptIds,
      contentVersions: Object.fromEntries(contentVersionEntries),
      createdAt: track.createdAt,
      recordedRevision: track.recordedRevision,
      adjustments,
    },
    bounds: {
      conceptIds: collectionBounds(
        track.conceptIds.length,
        conceptIds.length,
        ACTIVE_TRACK_CONCEPT_LIMIT,
        'first',
      ),
      contentVersions: collectionBounds(
        Object.keys(track.contentVersions).length,
        contentVersionEntries.length,
        ACTIVE_TRACK_CONCEPT_LIMIT + 3,
        'scope-priority',
      ),
      adjustments: collectionBounds(
        track.adjustments.length,
        adjustments.length,
        ACTIVE_TRACK_ADJUSTMENT_LIMIT,
        'recent',
      ),
    },
  }
}

function recentRemediationAttemptIds(
  artifacts: readonly ReviewArtifact[],
  limit: number,
) {
  let matchedCount = 0
  for (const artifact of artifacts) {
    if (artifact.type === 'remediation')
      matchedCount += artifact.attemptIds.length
  }
  const reversedIds: string[] = []
  for (
    let artifactIndex = artifacts.length - 1;
    artifactIndex >= 0 && reversedIds.length < limit;
    artifactIndex -= 1
  ) {
    const artifact = artifacts[artifactIndex]
    if (artifact.type !== 'remediation')
      continue
    for (
      let attemptIndex = artifact.attemptIds.length - 1;
      attemptIndex >= 0 && reversedIds.length < limit;
      attemptIndex -= 1
    ) {
      reversedIds.push(artifact.attemptIds[attemptIndex])
    }
  }
  return {
    ids: reversedIds.reverse(),
    matchedCount,
  }
}

export interface TeacherContextProjectionInput {
  snapshot: ClassroomSnapshot
  catalog: ContentPackCatalog
  scope: TeacherChatScope
}

/** Project the aggregate into the exact, bounded Lesson Orchestrator context. */
export function projectTeacherContext({
  snapshot,
  catalog,
  scope,
}: TeacherContextProjectionInput) {
  const assessmentHistory = createAssessmentHistoryIndex(snapshot)
  const remediationProvenance = createRemediationProvenanceIndex(snapshot)
  const activeTrack = snapshot.tracks.find(
    track => track.id === scope.learningTrackId,
  ) ?? null
  const derivedTrackPolicy = activeTrack
    ? deriveTrackPolicyState(snapshot, activeTrack, catalog)
    : null
  const skipMarkerBasisCandidates = activeTrack
    ? deriveSkipMarkerBasisCandidates(snapshot, activeTrack, catalog)
    : []
  const encounteredConceptIds = derivedTrackPolicy?.encounteredConceptIds
    .slice(-TRACK_POLICY_ENCOUNTERED_LIMIT) ?? []
  const trackPolicy = derivedTrackPolicy === null
    ? null
    : {
        ...derivedTrackPolicy,
        encounteredConceptIds,
        skipMarkerBasisCandidates,
      }
  const trackPolicyBounds = derivedTrackPolicy === null
    ? null
    : {
        encounteredConceptIds: collectionBounds(
          derivedTrackPolicy.encounteredConceptIds.length,
          encounteredConceptIds.length,
          TRACK_POLICY_ENCOUNTERED_LIMIT,
          'recent',
        ),
      }
  const scopeConceptId = scope.mode === 'review' ? scope.conceptId : null
  const activeTrackProjection = activeTrack === null
    ? null
    : projectActiveTrack(activeTrack, [
        scopeConceptId,
        trackPolicy?.frontierConceptId ?? null,
        trackPolicy?.adjustmentTargetConceptId ?? null,
      ])
  const exerciseInstances = snapshot.stream.filter(
    (entry): entry is ExerciseInstance => entry.type === 'exercise_instance',
  )
  const exerciseById = new Map(
    exerciseInstances.map(instance => [instance.id, instance]),
  )
  const exerciseTrackIds = new Map(
    exerciseInstances.map(instance => [instance.id, instance.learningTrackId]),
  )
  const attemptsById = new Map(
    snapshot.attempts.map(attempt => [attempt.id, attempt]),
  )
  const trackGoals = new Map(
    snapshot.tracks.map(track => [track.id, track.goal]),
  )
  const displayedReviewPack = scope.mode === 'review'
    ? catalog.getVersion(scope.conceptId, scope.contentVersion) ?? null
    : null
  const activeTrackConceptIds = new Set(activeTrack?.conceptIds ?? [])
  const activeTrackContractVersions = new Map<string, string>()
  for (const conceptId of activeTrack?.conceptIds ?? []) {
    const contentVersion = activeTrack?.contentVersions[conceptId]
    const pack = contentVersion
      ? catalog.getVersion(conceptId, contentVersion)
      : undefined
    if (pack) {
      activeTrackContractVersions.set(
        conceptId,
        pack.learningContractVersion,
      )
    }
  }
  const retainedArtifactMatchesScope = (
    artifact: ClassroomSnapshot['reviewArtifacts'][number]
      | ClassroomSnapshot['removedReviewArtifacts'][number],
  ): boolean => {
    if (scope.mode === 'review') {
      if (artifact.conceptId !== scope.conceptId)
        return false
      return artifact.type === 'clarification'
        ? artifact.contentVersion === scope.contentVersion
        : displayedReviewPack !== null
          && remediationProvenance.resolve(artifact)
            ?.learningContractVersion
            === displayedReviewPack.learningContractVersion
    }
    if (
      activeTrack === null
      || !activeTrackConceptIds.has(artifact.conceptId)
    ) {
      return false
    }
    if (artifact.type === 'clarification') {
      return artifact.contentVersion
        === activeTrack.contentVersions[artifact.conceptId]
    }
    return remediationProvenance.resolve(artifact)
      ?.learningContractVersion
      === activeTrackContractVersions.get(artifact.conceptId)
  }
  const remediationBelongsToActiveTrack = (
    artifact: Extract<ReviewArtifact, { type: 'remediation' }>,
  ): boolean => scope.mode === 'live'
    && scope.learningTrackId !== null
    && artifact.attemptIds.every((attemptId) => {
      const attempt = attemptsById.get(attemptId)
      return attempt !== undefined
        && exerciseById.get(attempt.exerciseInstanceId)
          ?.learningTrackId === scope.learningTrackId
    })
  const catalogSummaries = catalog.list()
  const catalogSummaryByConcept = new Map(
    catalogSummaries.map(summary => [summary.conceptId, summary]),
  )
  const selectedConceptIds: string[] = []
  const selectedConceptSet = new Set<string>()
  const addConcept = (conceptId: string | null) => {
    if (
      conceptId === null
      || selectedConceptIds.length === CLASSROOM_CONCEPT_LIMIT
      || selectedConceptSet.has(conceptId)
      || !catalogSummaryByConcept.has(conceptId)
    ) {
      return
    }
    selectedConceptSet.add(conceptId)
    selectedConceptIds.push(conceptId)
  }
  addConcept(scopeConceptId)
  addConcept(trackPolicy?.frontierConceptId ?? null)
  addConcept(trackPolicy?.adjustmentTargetConceptId ?? null)
  for (const conceptId of activeTrack?.conceptIds ?? []) {
    addConcept(conceptId)
    if (selectedConceptIds.length === CLASSROOM_CONCEPT_LIMIT)
      break
  }
  if (selectedConceptIds.length < CLASSROOM_CONCEPT_LIMIT) {
    for (const summary of catalogSummaries) {
      addConcept(summary.conceptId)
      if (selectedConceptIds.length === CLASSROOM_CONCEPT_LIMIT)
        break
    }
  }
  const concepts = selectedConceptIds.map((conceptId) => {
    const summary = catalogSummaryByConcept.get(conceptId)
    if (!summary)
      throw new Error(`Course Content Pack ${conceptId} disappeared.`)
    const currentVersion = summary.version
    const trackContentVersion = activeTrack?.contentVersions[summary.conceptId] ?? null
    const displayedReviewContentVersion
      = scope.mode === 'review'
        && scope.conceptId === summary.conceptId
        ? scope.contentVersion
        : null
    const version = displayedReviewContentVersion
      ?? trackContentVersion
      ?? currentVersion
    const pack = catalog.getVersion(summary.conceptId, version)
    const availability = catalog.availability(summary.conceptId, version)
      ?? summary.availability
    const projected = projectContentPackSummary({
      conceptId: summary.conceptId,
      title: pack?.concept.title ?? summary.title,
      version,
      availability,
      availabilityReason: availability === 'validated'
        ? null
        : version === currentVersion
          ? summary.availabilityReason
          : 'editorial_review',
    })
    return {
      ...projected,
      currentVersion,
      currentAvailability: summary.availability,
      trackContentVersion,
      progress: availability === 'validated' && pack
        ? deriveConceptProgress(snapshot, pack)
        : null,
    }
  })
  const scopedAttemptWindow = collectRecentMatching(
    snapshot.attempts,
    RECENT_ATTEMPT_LIMIT,
    (attempt) => {
      const instance = exerciseById.get(attempt.exerciseInstanceId)
      return scope.mode === 'live'
        ? instance?.learningTrackId === scope.learningTrackId
        : instance?.conceptId === scope.conceptId
          && instance.contentVersion === scope.contentVersion
    },
  )
  const recentAttempts = scopedAttemptWindow.items
    .map((attempt) => {
      const learningTrackId
        = exerciseTrackIds.get(attempt.exerciseInstanceId) ?? null
      return {
        id: attempt.id,
        exerciseInstanceId: attempt.exerciseInstanceId,
        learningTrackId,
        learningTrackGoal: learningTrackId === null
          ? null
          : trackGoals.get(learningTrackId) ?? null,
        passed: attempt.result.passed,
        assistance: attempt.assistance,
        createdAt: attempt.createdAt,
      }
    })
  const scopedEvidenceWindow = collectRecentMatching(
    snapshot.evidence,
    RECENT_EVIDENCE_LIMIT,
    (item) => {
      if (scope.mode === 'review') {
        return displayedReviewPack !== null
          && item.conceptId === scope.conceptId
          && item.learningContractVersion
          === displayedReviewPack.learningContractVersion
      }
      return item.exerciseInstanceId !== undefined
        && exerciseTrackIds.get(item.exerciseInstanceId)
        === scope.learningTrackId
    },
  )
  const recentEvidence = scopedEvidenceWindow.items
    .map((item) => {
      const learningTrackId = item.exerciseInstanceId === undefined
        ? null
        : exerciseTrackIds.get(item.exerciseInstanceId) ?? null
      return {
        id: item.id,
        type: item.type,
        outcome: item.outcome,
        conceptId: item.conceptId,
        learningSkillId: item.learningSkillId,
        contentVersion: item.contentVersion,
        learningContractVersion: item.learningContractVersion,
        templateId: item.templateId,
        templateVersion: item.templateVersion,
        exerciseInstanceId: item.exerciseInstanceId,
        attemptId: item.attemptId,
        createdAt: item.createdAt,
        learningTrackId,
        learningTrackGoal: learningTrackId === null
          ? null
          : trackGoals.get(learningTrackId) ?? null,
      }
    })
  const scopedExerciseWindow = collectRecentMatching(
    exerciseInstances,
    ACTIVE_EXERCISE_LIMIT,
    instance => scope.mode === 'live'
      ? instance.learningTrackId === scope.learningTrackId
      : instance.conceptId === scope.conceptId
        && instance.contentVersion === scope.contentVersion,
  )
  const recentExercises = scopedExerciseWindow.items
  const attemptCounts = new Map<string, number>()
  const passedExercises = new Set<string>()
  for (const attempt of snapshot.attempts) {
    attemptCounts.set(
      attempt.exerciseInstanceId,
      (attemptCounts.get(attempt.exerciseInstanceId) ?? 0) + 1,
    )
    if (attempt.result.passed)
      passedExercises.add(attempt.exerciseInstanceId)
  }
  const assistanceByExercise = new Map<string, Set<string>>()
  for (const event of snapshot.assistanceEvents) {
    const types = assistanceByExercise.get(event.exerciseInstanceId)
      ?? new Set<string>()
    types.add(event.type)
    assistanceByExercise.set(event.exerciseInstanceId, types)
  }
  const activeExercises = recentExercises.map((instance) => {
    const eligibility = assessmentHistory.projectCurrentEligibility(instance)
    return {
      id: instance.id,
      learningTrackId: instance.learningTrackId,
      learningTrackGoal: instance.learningTrackId === null
        ? null
        : trackGoals.get(instance.learningTrackId) ?? null,
      conceptId: instance.conceptId,
      contentVersion: instance.contentVersion,
      learningContractVersion: instance.learningContractVersion,
      learningSkillId: instance.learningSkillId,
      templateId: instance.templateId,
      templateVersion: instance.templateVersion,
      purpose: instance.purpose,
      effectiveDifficulty: instance.effectiveDifficulty,
      personalizationInputs: instance.personalizationInputs,
      taskType: instance.task.type,
      prompt: instance.task.type === 'quiz'
        ? instance.task.questions.slice(0, 8).map(question =>
            boundedDiagnosticText(question.question, 1_000))
        : boundedDiagnosticText(instance.task.prompt, 4_000),
      promptTruncated: instance.task.type === 'quiz'
        ? instance.task.questions.some(question =>
            question.question.length > 1_000)
        : instance.task.prompt.length > 4_000,
      instanceAttemptCount: attemptCounts.get(instance.id) ?? 0,
      instancePassed: passedExercises.has(instance.id),
      instanceAssistanceTypes: [
        ...(assistanceByExercise.get(instance.id) ?? []),
      ],
      assessmentEligibility: eligibility,
    }
  })
  const scopedArtifactGroups = groupReviewArtifacts(
    snapshot.reviewArtifacts.filter(retainedArtifactMatchesScope),
    {
      learningContractVersionFor: artifact =>
        remediationProvenance.resolve(artifact)
          ?.learningContractVersion ?? null,
    },
  ).sort((left, right) =>
    left.representative.updatedRevision
    - right.representative.updatedRevision
    || compareIds(left.representative.id, right.representative.id))
  const recentArtifactGroups = scopedArtifactGroups.slice(
    -RETAINED_ARTIFACT_LIMIT,
  )
  const retainedArtifacts = recentArtifactGroups.map((group) => {
    const artifact = group.representative
    const artifactIds = group.artifacts
      .slice(-ARTIFACT_PROVENANCE_ID_LIMIT)
      .map(item => item.id)
    const failedAttempts = recentRemediationAttemptIds(
      group.artifacts,
      ARTIFACT_PROVENANCE_ID_LIMIT,
    )
    return {
      id: artifact.id,
      artifactIds,
      artifactCount: group.artifacts.length,
      artifactIdsTruncated: artifactIds.length < group.artifacts.length,
      type: artifact.type,
      conceptId: artifact.conceptId,
      misconceptionTheme: artifact.misconceptionTheme,
      markdown: artifact.markdown,
      ...(artifact.type === 'remediation'
        ? {
            learningSkillId: artifact.learningSkillId,
            learningContractVersion: group.learningContractVersion,
            diagnosticStatus: artifact.diagnosticStatus,
            failedAttemptIds: failedAttempts.ids,
            failedAttemptCount: failedAttempts.matchedCount,
            failedAttemptIdsTruncated:
                    failedAttempts.matchedCount > failedAttempts.ids.length,
          }
        : {
            contentVersion: artifact.contentVersion,
            retainedAsReadOnly: artifact.retainedAsReadOnly,
          }),
    }
  })
  const pendingRemediationWindow = collectMostRecentMatching(
    snapshot.reviewArtifacts,
    PENDING_REMEDIATION_LIMIT,
    (artifact): artifact is Extract<
      ClassroomSnapshot['reviewArtifacts'][number],
      { type: 'remediation' }
    > =>
      artifact.type === 'remediation'
      && artifact.diagnosticStatus === 'pending'
      && retainedArtifactMatchesScope(artifact)
      && (
        scope.mode === 'review'
        || remediationBelongsToActiveTrack(artifact)
      ),
    (left, right) =>
      left.updatedRevision - right.updatedRevision
      || compareIds(left.id, right.id),
  )
  const pendingRemediations = pendingRemediationWindow.items
    .map(artifact => ({
      id: artifact.id,
      conceptId: artifact.conceptId,
      learningSkillId: artifact.learningSkillId,
      failedAttemptIds: artifact.attemptIds.slice(
        -ARTIFACT_PROVENANCE_ID_LIMIT,
      ),
      failedAttemptCount: artifact.attemptIds.length,
      failedAttemptIdsTruncated:
              artifact.attemptIds.length > ARTIFACT_PROVENANCE_ID_LIMIT,
      evidenceIds: artifact.evidenceIds.slice(
        -ARTIFACT_PROVENANCE_ID_LIMIT,
      ),
      evidenceCount: artifact.evidenceIds.length,
      evidenceIdsTruncated:
              artifact.evidenceIds.length > ARTIFACT_PROVENANCE_ID_LIMIT,
    }))
  const suppressionWindow = collectMostRecentMatching(
    snapshot.removedReviewArtifacts,
    RETENTION_SUPPRESSION_LIMIT,
    artifact =>
      artifact.suppressionActive
      && retainedArtifactMatchesScope(artifact),
    (left, right) =>
      left.removedRevision - right.removedRevision
      || compareIds(left.id, right.id),
  )
  const activeRetentionSuppressions = suppressionWindow.items
    .map(artifact => ({
      id: artifact.id,
      type: artifact.type,
      conceptId: artifact.conceptId,
      misconceptionTheme: artifact.misconceptionTheme,
      ...(artifact.type === 'remediation'
        ? {
            learningSkillId: artifact.learningSkillId,
            learningContractVersion:
                      remediationProvenance.resolve(artifact)
                        ?.learningContractVersion ?? null,
            failedAttemptIds: artifact.attemptIds.slice(
              -ARTIFACT_PROVENANCE_ID_LIMIT,
            ),
            failedAttemptCount: artifact.attemptIds.length,
            failedAttemptIdsTruncated:
                    artifact.attemptIds.length > ARTIFACT_PROVENANCE_ID_LIMIT,
          }
        : {
            contentVersion: artifact.contentVersion,
          }),
    }))
  return {
    teacherExposureActive: snapshot.teacherExposureEpoch !== null,
    activeTrack: activeTrackProjection?.track ?? null,
    activeTrackBounds: activeTrackProjection?.bounds ?? null,
    trackPolicy,
    trackPolicyBounds,
    concepts,
    chatScope: scope,
    displayedReviewContentVersion: scope.mode === 'review'
      ? scope.contentVersion
      : null,
    recentAttempts,
    recentEvidence,
    activeExercises,
    retainedArtifacts,
    pendingRemediations,
    activeRetentionSuppressions,
    collectionBounds: {
      concepts: collectionBounds(
        catalogSummaries.length,
        concepts.length,
        CLASSROOM_CONCEPT_LIMIT,
        'scope-priority',
      ),
      recentAttempts: collectionBounds(
        scopedAttemptWindow.matchedCount,
        recentAttempts.length,
        RECENT_ATTEMPT_LIMIT,
        'recent',
      ),
      recentEvidence: collectionBounds(
        scopedEvidenceWindow.matchedCount,
        recentEvidence.length,
        RECENT_EVIDENCE_LIMIT,
        'recent',
      ),
      activeExercises: collectionBounds(
        scopedExerciseWindow.matchedCount,
        activeExercises.length,
        ACTIVE_EXERCISE_LIMIT,
        'recent',
      ),
      retainedArtifacts: collectionBounds(
        scopedArtifactGroups.length,
        retainedArtifacts.length,
        RETAINED_ARTIFACT_LIMIT,
        'recent',
      ),
      pendingRemediations: collectionBounds(
        pendingRemediationWindow.matchedCount,
        pendingRemediations.length,
        PENDING_REMEDIATION_LIMIT,
        'recent',
      ),
      activeRetentionSuppressions: collectionBounds(
        suppressionWindow.matchedCount,
        activeRetentionSuppressions.length,
        RETENTION_SUPPRESSION_LIMIT,
        'recent',
      ),
    },
  }
}

export type TeacherContextProjection = ReturnType<typeof projectTeacherContext>
