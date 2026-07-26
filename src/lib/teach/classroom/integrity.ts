import type { ContentPackCatalog } from './content-catalog'
import type { ExerciseTask } from './content-packs'
import type {
  AttemptSubmission,
  ClassroomSnapshot,
  ExerciseAssistanceEvent,
  ExerciseAttempt,
  ExerciseInstance,
} from './state'
import { evaluateOutput } from '../feedback/evaluate'
import {
  EXERCISE_PERSONALIZATION_POLICY_VERSION,
  personalizeExerciseTemplate,
} from './exercise-personalization'
import {
  clarificationReviewGroupKey,
  clarificationSuppressionKey,
  remediationSuppressionKey,
} from './retention'
import { createRemediationProvenanceIndex } from './remediation-provenance'
import { assertSkipMarkerBasis } from './skip-marker-policy'
import { MAX_REMEDIATION_DIAGNOSTIC_ATTEMPTS } from './state'
import { satisfiesSourceRequirements } from './source-requirements'
import { assertTrackAdjustment, assertTrackConceptAccess } from './track-policy'
import {
  createAssessmentHistoryIndex,
} from './assessment-policy'
import {
  deriveUnresolvedFailureEvidenceIds,
} from './personalization-candidates'
import { renderPersistedDiagnostic } from './persistence-policy'

export function deriveAttemptAssistance(
  events: readonly ExerciseAssistanceEvent[],
  teacherExposed = false,
): ExerciseAttempt['assistance'] {
  if (teacherExposed)
    return 'teacher_exposure'
  if (events.length > 0)
    return 'hint'
  return 'none'
}

function normalizeRecallAnswer(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ')
}

function sameAnswerSet(actual: number[], expected: number[]): boolean {
  if (actual.length !== expected.length || new Set(actual).size !== actual.length)
    return false
  const expectedSet = new Set(expected)
  return actual.every(index => expectedSet.has(index))
}

/**
 * The one deterministic evaluator used both when creating an Attempt and when
 * validating a persisted Attempt. It never delegates grading to the model.
 */
export function evaluateDeterministicSubmission(
  task: ExerciseTask,
  submission: AttemptSubmission,
  run?: { runnerOk: boolean, stdout: string, stdoutTruncated: boolean },
): boolean {
  if (task.type !== submission.type)
    throw new Error('Exercise Attempt submission does not match its Exercise Template')

  if (task.type === 'code_output' && submission.type === 'code_output') {
    if (!run)
      throw new Error('A code-output Exercise Attempt requires an observable run result')
    if (task.matchMode === 'contains' && task.expectedOutput.trim().length === 0)
      throw new Error('A contains output check requires non-empty expected output')
    return satisfiesSourceRequirements(submission.code, task.sourceRequirements)
      && run.runnerOk
      && !run.stdoutTruncated
      && evaluateOutput(run.stdout, task.expectedOutput, task.matchMode)
  }

  if (task.type === 'recall' && submission.type === 'recall') {
    return normalizeRecallAnswer(submission.answer)
      === normalizeRecallAnswer(task.referenceAnswer)
  }

  if (task.type === 'quiz' && submission.type === 'quiz') {
    for (const [questionIndex, answers] of submission.answerIndices.entries()) {
      const question = task.questions[questionIndex]
      if (question && answers.some(index => index >= question.options.length)) {
        throw new Error(
          `Quiz submission contains an invalid option for question ${questionIndex + 1}`,
        )
      }
    }
    return submission.answerIndices.length === task.questions.length
      && task.questions.every((question, index) =>
        sameAnswerSet(submission.answerIndices[index] ?? [], question.answerIndices))
  }

  throw new Error('Exercise Attempt submission does not match its Exercise Template')
}

function assertUniqueIds(snapshot: ClassroomSnapshot): void {
  const ids = [
    ...snapshot.tracks.map(item => item.id),
    ...snapshot.tracks.flatMap(track => track.adjustments.map(item => item.id)),
    ...snapshot.stream.map(item => item.id),
    ...snapshot.assistanceEvents.map(item => item.id),
    ...(snapshot.teacherExposureEpoch ? [snapshot.teacherExposureEpoch.id] : []),
    ...snapshot.attempts.map(item => item.id),
    ...snapshot.evidence.map(item => item.id),
    ...snapshot.reviewArtifacts.map(item => item.id),
    ...snapshot.removedReviewArtifacts.map(item => item.id),
  ]
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id))
      throw new Error(`AI Classroom contains duplicate id ${id}`)
    seen.add(id)
  }
}

function exerciseInstances(snapshot: ClassroomSnapshot): Map<string, ExerciseInstance> {
  return new Map(snapshot.stream
    .filter((entry): entry is ExerciseInstance => entry.type === 'exercise_instance')
    .map(instance => [instance.id, instance]))
}

function assertUniqueReferences(owner: string, references: string[]): void {
  if (new Set(references).size !== references.length)
    throw new Error(`${owner} contains duplicate references`)
}

function assertPackBlockOrder(
  entryId: string,
  blockIds: string[],
  packBlockIds: string[],
): void {
  assertUniqueReferences(`Classroom Stream entry ${entryId}`, blockIds)
  const order = new Map(packBlockIds.map((blockId, index) => [blockId, index]))
  let previous = -1
  for (const blockId of blockIds) {
    const current = order.get(blockId)
    if (current === undefined)
      throw new Error(`Classroom Stream entry ${entryId} references a missing Core Content Block`)
    if (current <= previous)
      throw new Error(`Classroom Stream entry ${entryId} changed Course Content Pack order`)
    previous = current
  }
}

function assertAttemptResult(
  attempt: ExerciseAttempt,
  instance: ExerciseInstance,
): void {
  let expectedPassed: boolean
  if (attempt.submission.type === 'code_output') {
    if (instance.task.type !== 'code_output') {
      throw new Error(
        `Exercise Attempt ${attempt.id} submission does not match its task`,
      )
    }
    const {
      runnerOk,
      phase,
      stdout,
      stderr,
      compilerOutput,
      outputEvaluation,
      exitCode,
    } = attempt.result
    if (
      typeof runnerOk !== 'boolean'
      || (phase !== 'compile' && phase !== 'run')
      || stdout === undefined
      || stderr === undefined
      || compilerOutput === undefined
      || outputEvaluation === undefined
      || exitCode === undefined
      || attempt.result.feedback !== undefined
    ) {
      throw new Error(`Exercise Attempt ${attempt.id} has no complete observable run result`)
    }
    if (
      (phase === 'compile' && (
        runnerOk
        || exitCode !== null
        || stdout.originalUtf8Bytes !== 0
        || stdout.sourceTruncated
        || stderr.originalUtf8Bytes !== 0
        || stderr.sourceTruncated
      ))
      || (phase === 'run' && (
        exitCode === null
        || runnerOk !== (exitCode === 0)
      ))
    ) {
      throw new Error(`Exercise Attempt ${attempt.id} has a contradictory run phase`)
    }
    if (
      stdout.omittedUtf8Bytes === 0
      && !stdout.sourceTruncated
      && evaluateOutput(
        renderPersistedDiagnostic(stdout),
        instance.task.expectedOutput,
        instance.task.matchMode,
      ) !== outputEvaluation.matched
    ) {
      throw new Error(
        `Exercise Attempt ${attempt.id} contradicts its persisted output match`,
      )
    }
    if (outputEvaluation.stdoutSha256 !== stdout.sha256) {
      throw new Error(
        `Exercise Attempt ${attempt.id} output evaluation drifted from its observation`,
      )
    }
    if (
      outputEvaluation.stdoutSourceTruncated !== stdout.sourceTruncated
      || (stdout.sourceTruncated && outputEvaluation.matched)
    ) {
      throw new Error(
        `Exercise Attempt ${attempt.id} contradicts its stdout truncation observation`,
      )
    }
    expectedPassed = satisfiesSourceRequirements(
      attempt.submission.code,
      instance.task.sourceRequirements,
    ) && runnerOk && !stdout.sourceTruncated && outputEvaluation.matched
  }
  else {
    if (
      attempt.result.runnerOk !== undefined
      || attempt.result.phase !== undefined
      || attempt.result.stdout !== undefined
      || attempt.result.stderr !== undefined
      || attempt.result.compilerOutput !== undefined
      || attempt.result.outputEvaluation !== undefined
      || attempt.result.exitCode !== undefined
      || attempt.result.feedback !== undefined
    ) {
      throw new Error(`Exercise Attempt ${attempt.id} has inapplicable runner output`)
    }
    expectedPassed = evaluateDeterministicSubmission(instance.task, attempt.submission)
  }

  if (attempt.result.passed !== expectedPassed)
    throw new Error(`Exercise Attempt ${attempt.id} contradicts deterministic evaluation`)
}

/** Validate links and provenance that cannot be expressed by standalone schemas. */
export function assertClassroomIntegrity(
  snapshot: ClassroomSnapshot,
  catalog: ContentPackCatalog,
): void {
  assertUniqueIds(snapshot)
  // Historical structure is checked against the exact retained pack identity,
  // not today's mutable approval decision. Command handlers keep using the
  // original catalog and therefore still require current validation before
  // authorizing new mainline work.
  const historicalCatalog: ContentPackCatalog = {
    ...catalog,
    requireValidatedVersion: (conceptId, version) => {
      const pack = catalog.getVersion(conceptId, version)
      if (!pack) {
        throw new Error(
          `Historical Concept Version ${conceptId}@${version} is unavailable`,
        )
      }
      return pack
    },
  }

  const tracks = new Map(snapshot.tracks.map(track => [track.id, track]))
  if (snapshot.activeTrackId && !tracks.has(snapshot.activeTrackId))
    throw new Error(`Active Learning Track ${snapshot.activeTrackId} does not exist`)

  let previousTrackRevision = 0
  for (const track of snapshot.tracks) {
    if (
      track.recordedRevision <= previousTrackRevision
      || track.recordedRevision > snapshot.revision
    ) {
      throw new Error(`Learning Track ${track.id} has an invalid recorded revision`)
    }
    previousTrackRevision = track.recordedRevision
    assertUniqueReferences(`Learning Track ${track.id}`, track.conceptIds)
    const recordedConceptIds = Object.keys(track.contentVersions)
    if (
      recordedConceptIds.length !== track.conceptIds.length
      || recordedConceptIds.some(conceptId => !track.conceptIds.includes(conceptId))
    ) {
      throw new Error(`Learning Track ${track.id} has incomplete Content Version provenance`)
    }
    const available = new Set<string>()
    for (const conceptId of track.conceptIds) {
      const contentVersion = track.contentVersions[conceptId]
      const pack = contentVersion
        ? catalog.getVersion(conceptId, contentVersion)
        : undefined
      if (!pack) {
        throw new Error(
          `Learning Track ${track.id} references unknown Content Version `
          + `${conceptId}@${contentVersion ?? '(missing)'}`,
        )
      }
      const unmet = pack.concept.prerequisites.filter(prerequisite => !available.has(prerequisite))
      if (unmet.length > 0) {
        throw new Error(
          `Learning Track ${track.id} places ${conceptId} before prerequisite ${unmet.join(', ')}`,
        )
      }
      available.add(conceptId)
    }
    let previousAdjustmentRevision = track.recordedRevision
    for (const adjustment of track.adjustments) {
      if (
        adjustment.recordedRevision <= previousAdjustmentRevision
        || adjustment.recordedRevision > snapshot.revision
      ) {
        throw new Error(
          `Track Adjustment ${adjustment.id} has an invalid recorded revision`,
        )
      }
      previousAdjustmentRevision = adjustment.recordedRevision
      if (!track.conceptIds.includes(adjustment.conceptId)) {
        throw new Error(
          `Track Adjustment references out-of-track Concept ${adjustment.conceptId}`,
        )
      }
      if (adjustment.type === 'delay')
        assertUniqueReferences(`Track Adjustment ${adjustment.id}`, adjustment.blockedEvidenceIds)
      assertTrackAdjustment(snapshot, track, adjustment, historicalCatalog)
    }
  }

  const instances = exerciseInstances(snapshot)
  const assessmentHistory = createAssessmentHistoryIndex(snapshot)
  const attempts = new Map(snapshot.attempts.map(attempt => [attempt.id, attempt]))
  const evidence = new Map(snapshot.evidence.map(item => [item.id, item]))
  const artifacts = new Map(snapshot.reviewArtifacts.map(item => [item.id, item]))
  const removedArtifacts = new Map(snapshot.removedReviewArtifacts.map(item => [item.id, item]))
  const remediationProvenance = createRemediationProvenanceIndex(snapshot)

  let previousAssistanceRevision = 0
  const behavioralRevisions = new Set<number>()
  const hintIndices = new Map<string, Set<number>>()
  const teacherExposure = snapshot.teacherExposureEpoch
  if (teacherExposure) {
    if (teacherExposure.recordedRevision > snapshot.revision) {
      throw new Error('Teacher Exposure Epoch has an invalid recorded revision')
    }
    behavioralRevisions.add(teacherExposure.recordedRevision)
  }
  for (const event of snapshot.assistanceEvents) {
    if (
      event.recordedRevision <= previousAssistanceRevision
      || event.recordedRevision > snapshot.revision
      || behavioralRevisions.has(event.recordedRevision)
    ) {
      throw new Error(`Exercise Assistance ${event.id} has an invalid recorded revision`)
    }
    previousAssistanceRevision = event.recordedRevision
    behavioralRevisions.add(event.recordedRevision)
    const instance = instances.get(event.exerciseInstanceId)
    if (!instance)
      throw new Error(`Exercise Assistance ${event.id} has no prior Exercise Instance`)
    if (event.recordedRevision <= instance.recordedRevision)
      throw new Error(`Exercise Assistance ${event.id} predates its Exercise Instance revision`)
    if (instance.task.type !== 'code_output') {
      throw new Error(
        `Exercise Assistance ${event.id} applies to an unsupported Exercise Instance`,
      )
    }
    if (event.hintIndex >= instance.task.hints.length)
      throw new Error(`Exercise Assistance ${event.id} references a missing hint`)
    const indices = hintIndices.get(instance.id) ?? new Set<number>()
    if (indices.has(event.hintIndex) || event.hintIndex !== indices.size)
      throw new Error(`Exercise Assistance ${event.id} changed hint order`)
    indices.add(event.hintIndex)
    hintIndices.set(instance.id, indices)
  }

  let previousStreamRevision = 0
  const tutoringStepEntryKeys = new Set<string>()
  const retentionRequestIds = new Set<string>()
  for (const entry of snapshot.stream) {
    if (
      entry.recordedRevision <= previousStreamRevision
      || entry.recordedRevision > snapshot.revision
    ) {
      throw new Error(`Classroom Stream entry ${entry.id} has an invalid recorded revision`)
    }
    previousStreamRevision = entry.recordedRevision
    if (
      entry.type === 'bridge_note'
      && (
        !teacherExposure
        || teacherExposure.recordedRevision > entry.recordedRevision
      )
    ) {
      throw new Error(
        `${entry.type} ${entry.id} has no prior Teacher Exposure Epoch`,
      )
    }
    const track = entry.learningTrackId === null
      ? undefined
      : tracks.get(entry.learningTrackId)
    if (entry.learningTrackId !== null && !track)
      throw new Error(`Classroom Stream entry ${entry.id} references a missing Learning Track`)
    if (track && entry.recordedRevision <= track.recordedRevision)
      throw new Error(`Classroom Stream entry ${entry.id} predates its Learning Track revision`)

    const latestPack = catalog.get(entry.conceptId)
    if (!latestPack)
      throw new Error(`Classroom Stream references unknown Concept ${entry.conceptId}`)

    if (
      entry.type === 'content_reference_group'
      || entry.type === 'exercise_instance'
      || entry.type === 'bridge_note'
      || entry.type === 'skip_marker'
    ) {
      const stepKey = `${entry.learningTrackId}\0${entry.type}\0${entry.tutoringStepId}`
      if (tutoringStepEntryKeys.has(stepKey)) {
        throw new Error(
          `Tutoring Step ${entry.tutoringStepId} repeats a ${entry.type} entry`,
        )
      }
      tutoringStepEntryKeys.add(stepKey)
      if (!track || !track.conceptIds.includes(entry.conceptId)) {
        throw new Error(
          `Mainline Classroom Stream entry ${entry.id} is outside its Learning Track`,
        )
      }
      if (entry.type !== 'skip_marker') {
        assertTrackConceptAccess(
          snapshot,
          track,
          entry.conceptId,
          entry.type === 'exercise_instance' && entry.purpose === 'placement'
            ? 'placement'
            : 'mainline',
          historicalCatalog,
          entry.recordedRevision,
        )
      }
    }

    if ('contentVersion' in entry) {
      const pack = catalog.getVersion(entry.conceptId, entry.contentVersion)
      if (!pack) {
        throw new Error(
          `Classroom Stream entry ${entry.id} references unknown Content Version `
          + `${entry.conceptId}@${entry.contentVersion}`,
        )
      }
      if (entry.packId !== pack.id)
        throw new Error(`Classroom Stream entry ${entry.id} references the wrong Course Content Pack`)
      const isExplicitReviewVersion = entry.type === 'exercise_instance'
        && entry.purpose === 'review'
      if (
        !isExplicitReviewVersion
        && track?.contentVersions[entry.conceptId] !== entry.contentVersion
      ) {
        throw new Error(
          `Mainline Classroom Stream entry ${entry.id} drifted from its Learning Track Content Version`,
        )
      }

      if (entry.type === 'content_reference_group' || entry.type === 'skip_marker') {
        assertPackBlockOrder(entry.id, entry.blockIds, pack.blocks.map(block => block.id))
      }
      if (entry.type === 'skip_marker') {
        if (!track)
          throw new Error(`Skip Marker ${entry.id} has no Learning Track`)
        assertSkipMarkerBasis(
          snapshot,
          track,
          entry.conceptId,
          entry.basis,
          historicalCatalog,
          entry.recordedRevision,
        )
      }
      if (entry.type === 'content_reference_group') {
        if (!pack.learningSkills.some(skill => skill.id === entry.learningSkillId)) {
          throw new Error(
            `Classroom Stream entry ${entry.id} references a missing Learning Skill`,
          )
        }
      }
      if (entry.type === 'exercise_instance') {
        const template = pack.exerciseTemplates.find(candidate => candidate.id === entry.templateId)
        if (!template || template.version !== entry.templateVersion)
          throw new Error(`Exercise Instance ${entry.id} references a missing Exercise Template`)
        if (entry.learningContractVersion !== pack.learningContractVersion) {
          throw new Error(
            `Exercise Instance ${entry.id} changed its Learning Contract Version`,
          )
        }
        if (template.learningSkillId !== entry.learningSkillId)
          throw new Error(`Exercise Instance ${entry.id} references the wrong Learning Skill`)
        if (template.purpose !== entry.purpose)
          throw new Error(`Exercise Instance ${entry.id} changed its Exercise Template purpose`)

        const inputs = entry.personalizationInputs
        assertUniqueReferences(
          `Exercise Instance ${entry.id} unresolved-failure inputs`,
          inputs.unresolvedFailureEvidenceIds,
        )
        assertUniqueReferences(
          `Exercise Instance ${entry.id} Remediation inputs`,
          inputs.remediationArtifactIds,
        )
        const unresolvedFailureEvidenceIds = new Set(
          deriveUnresolvedFailureEvidenceIds(
            snapshot,
            {
              conceptId: entry.conceptId,
              learningSkillId: entry.learningSkillId,
              learningContractVersion: entry.learningContractVersion,
            },
            entry.recordedRevision,
          ),
        )
        for (const evidenceId of inputs.unresolvedFailureEvidenceIds) {
          if (!unresolvedFailureEvidenceIds.has(evidenceId)) {
            throw new Error(
              `Exercise Instance ${entry.id} references resolved or inapplicable failure Learning Evidence`,
            )
          }
        }
        for (const artifactId of inputs.remediationArtifactIds) {
          const artifact = artifacts.get(artifactId)
          const removedArtifact = removedArtifacts.get(artifactId)
          const activeProvenance = artifact?.type === 'remediation'
            ? remediationProvenance.resolve(artifact)
            : null
          const removedProvenance = removedArtifact?.type === 'remediation'
            ? remediationProvenance.resolve(removedArtifact)
            : null
          const activeReferenceIsValid = artifact?.type === 'remediation'
            && artifact.conceptId === entry.conceptId
            && artifact.learningSkillId === entry.learningSkillId
            && artifact.diagnosticStatus === 'ready'
            && artifact.updatedRevision < entry.recordedRevision
            && activeProvenance?.conceptId === entry.conceptId
            && activeProvenance.learningSkillId === entry.learningSkillId
            && activeProvenance.learningContractVersion
            === entry.learningContractVersion
          const removedReferenceIsValid = removedArtifact?.type === 'remediation'
            && removedArtifact.conceptId === entry.conceptId
            && removedArtifact.learningSkillId === entry.learningSkillId
            && removedArtifact.misconceptionTheme !== null
            && removedArtifact.updatedRevision < entry.recordedRevision
            && removedArtifact.removedRevision > entry.recordedRevision
            && removedProvenance?.conceptId === entry.conceptId
            && removedProvenance.learningSkillId === entry.learningSkillId
            && removedProvenance.learningContractVersion
            === entry.learningContractVersion
          if (!activeReferenceIsValid && !removedReferenceIsValid) {
            throw new Error(
              `Exercise Instance ${entry.id} references an inapplicable Remediation`,
            )
          }
        }
        const personalized = personalizeExerciseTemplate(template, inputs)
        if (
          entry.personalizationPolicyVersion
          !== EXERCISE_PERSONALIZATION_POLICY_VERSION
          || entry.personalizationPolicyVersion !== personalized.policyVersion
          || entry.effectiveDifficulty !== personalized.effectiveDifficulty
          || JSON.stringify(entry.task) !== JSON.stringify(personalized.task)
        ) {
          throw new Error(
            `Exercise Instance ${entry.id} does not match its versioned personalization policy`,
          )
        }
      }
    }

    if (entry.type === 'retention_marker') {
      if (entry.request) {
        if (retentionRequestIds.has(entry.request.artifactId)) {
          throw new Error(
            `Retention request ${entry.request.artifactId} was committed more than once`,
          )
        }
        retentionRequestIds.add(entry.request.artifactId)
      }
      const artifact = artifacts.get(entry.artifactId)
      const removedArtifact = removedArtifacts.get(entry.artifactId)
      const activeReferenceIsValid = artifact?.type === entry.artifactType
        && artifact.conceptId === entry.conceptId
        && artifact.createdRevision <= entry.recordedRevision
      const removedReferenceIsValid = removedArtifact?.type === entry.artifactType
        && removedArtifact.conceptId === entry.conceptId
        && removedArtifact.createdRevision <= entry.recordedRevision
        && removedArtifact.removedRevision > entry.recordedRevision
      if (!activeReferenceIsValid && !removedReferenceIsValid)
        throw new Error(`Retention Marker ${entry.id} contradicts its Review Artifact`)

      if (entry.artifactType === 'remediation') {
        if (entry.request?.type === 'retain_clarification') {
          throw new Error(
            `Remediation Retention Marker ${entry.id} has a Clarification request`,
          )
        }
        const remediation = artifact?.type === 'remediation'
          ? artifact
          : removedArtifact?.type === 'remediation'
            ? removedArtifact
            : null
        if (!remediation) {
          throw new Error(
            `Remediation Retention Marker ${entry.id} has no provenance artifact`,
          )
        }
        if (
          entry.request?.type === 'retain_remediation'
          && !remediation.attemptIds.includes(entry.request.failedAttemptId)
        ) {
          throw new Error(
            `Remediation Retention Marker ${entry.id} changed its failed Attempt request`,
          )
        }
        for (const attemptId of remediation.attemptIds) {
          const attempt = attempts.get(attemptId)
          const instance = attempt
            ? instances.get(attempt.exerciseInstanceId)
            : undefined
          if (!instance || instance.learningTrackId !== entry.learningTrackId) {
            throw new Error(
              `Remediation Retention Marker ${entry.id} drifted from its failed Exercise Track`,
            )
          }
        }
      }
      else {
        const clarification = artifact?.type === 'clarification'
          ? artifact
          : removedArtifact?.type === 'clarification'
            ? removedArtifact
            : null
        if (!clarification || entry.request?.type !== 'retain_clarification') {
          throw new Error(
            `Clarification Retention Marker ${entry.id} has no exact retention request`,
          )
        }
        if (
          entry.request.learningTrackId !== entry.learningTrackId
          || entry.request.conceptId !== entry.conceptId
          || entry.request.conceptId !== clarification.conceptId
          || entry.request.contentVersion !== clarification.contentVersion
          || entry.request.misconceptionTheme
          !== clarification.misconceptionTheme
        ) {
          throw new Error(
            `Clarification Retention Marker ${entry.id} changed its retention request`,
          )
        }
        if (
          entry.learningTrackId !== null
          && (
            !track
            || track.contentVersions[entry.conceptId]
            !== clarification.contentVersion
          )
        ) {
          throw new Error(
            `Clarification Retention Marker ${entry.id} drifted from its Learning Track pin`,
          )
        }
      }
    }
  }

  let previousAttemptRevision = 0
  for (const attempt of snapshot.attempts) {
    const instance = instances.get(attempt.exerciseInstanceId)
    if (!instance)
      throw new Error(`Exercise Attempt ${attempt.id} has no Exercise Instance`)
    if (attempt.recordedRevision <= instance.recordedRevision)
      throw new Error(`Exercise Attempt ${attempt.id} predates its Exercise Instance revision`)
    if (
      attempt.recordedRevision <= previousAttemptRevision
      || attempt.recordedRevision > snapshot.revision
      || behavioralRevisions.has(attempt.recordedRevision)
    ) {
      throw new Error(`Exercise Attempt ${attempt.id} has an invalid recorded revision`)
    }
    previousAttemptRevision = attempt.recordedRevision
    behavioralRevisions.add(attempt.recordedRevision)
    assertUniqueReferences(
      `Exercise Attempt ${attempt.id} assistance`,
      attempt.assistanceEventIds,
    )
    const applicableAssistance = assessmentHistory.applicableAssistance(
      instance,
      attempt.recordedRevision,
    )
    const applicableIds = new Set(applicableAssistance.map(event => event.id))
    const applicableTeacherExposure
      = teacherExposure
        && teacherExposure.recordedRevision < attempt.recordedRevision
        ? teacherExposure
        : null
    if (
      attempt.assistanceEventIds.length !== applicableIds.size
      || attempt.assistanceEventIds.some(id => !applicableIds.has(id))
    ) {
      throw new Error(`Exercise Attempt ${attempt.id} omitted persisted assistance`)
    }
    if (
      attempt.teacherExposureEpochId !== (applicableTeacherExposure?.id ?? null)
    ) {
      throw new Error(
        `Exercise Attempt ${attempt.id} contradicts its Teacher Exposure Epoch`,
      )
    }
    if (
      attempt.assistance !== deriveAttemptAssistance(
        applicableAssistance,
        applicableTeacherExposure !== null,
      )
    ) {
      throw new Error(`Exercise Attempt ${attempt.id} contradicts persisted assistance`)
    }
    assertAttemptResult(attempt, instance)
  }

  const evidenceCountByAttempt = new Map<string, number>()
  for (const item of snapshot.evidence) {
    const pack = catalog.getVersion(item.conceptId, item.contentVersion)
    if (!pack) {
      throw new Error(
        `Learning Evidence ${item.id} references unknown Content Version `
        + `${item.conceptId}@${item.contentVersion}`,
      )
    }
    if (!pack.learningSkills.some(skill => skill.id === item.learningSkillId))
      throw new Error(`Learning Evidence ${item.id} references a missing Learning Skill`)
    if (item.learningContractVersion !== pack.learningContractVersion) {
      throw new Error(
        `Learning Evidence ${item.id} changed its Learning Contract Version`,
      )
    }

    if (!item.attemptId || !item.exerciseInstanceId || !item.templateId || !item.templateVersion)
      throw new Error(`Learning Evidence ${item.id} requires an observable Exercise Attempt`)
    const attempt = attempts.get(item.attemptId)
    const instance = instances.get(item.exerciseInstanceId)
    if (!attempt || !instance || attempt.exerciseInstanceId !== instance.id)
      throw new Error(`Learning Evidence ${item.id} references a missing Exercise Attempt`)
    if (
      item.conceptId !== instance.conceptId
      || item.learningSkillId !== instance.learningSkillId
      || item.contentVersion !== instance.contentVersion
      || item.learningContractVersion !== instance.learningContractVersion
      || item.templateId !== instance.templateId
      || item.templateVersion !== instance.templateVersion
      || item.createdAt !== attempt.createdAt
    ) {
      throw new Error(`Learning Evidence ${item.id} does not trace to its Exercise Instance`)
    }
    evidenceCountByAttempt.set(item.attemptId, (evidenceCountByAttempt.get(item.attemptId) ?? 0) + 1)
    const expectedOutcome = attempt.result.passed ? 'success' : 'failure'
    if (item.outcome !== expectedOutcome)
      throw new Error(`Learning Evidence ${item.id} contradicts its Exercise Attempt result`)
    const expectedType = assessmentHistory.expectedEvidenceType(instance, attempt)
    if (item.type !== expectedType) {
      throw new Error(
        `Learning Evidence ${item.id} contradicts its assistance and assessment freshness`,
      )
    }
  }
  for (const attempt of snapshot.attempts) {
    if (evidenceCountByAttempt.get(attempt.id) !== 1)
      throw new Error(`Exercise Attempt ${attempt.id} must have exactly one Learning Evidence`)
  }

  const activeRemediationCountByAttempt = new Map<string, number>()
  const activeClarificationKeys = new Set<string>()
  for (const artifact of snapshot.reviewArtifacts) {
    if (artifact.type === 'clarification') {
      const pack = catalog.getVersion(artifact.conceptId, artifact.contentVersion)
      if (!pack) {
        throw new Error(
          `Clarification ${artifact.id} references unknown Content Version `
          + `${artifact.conceptId}@${artifact.contentVersion}`,
        )
      }
      // retainedAsReadOnly records creation provenance. Review availability is
      // external mutable policy, so reopening history must not equate the two.
      if (artifact.updatedAt < artifact.createdAt)
        throw new Error(`Clarification ${artifact.id} has invalid display timestamps`)
      if (
        artifact.createdRevision > artifact.updatedRevision
        || artifact.updatedRevision > snapshot.revision
      ) {
        throw new Error(`Clarification ${artifact.id} has invalid lifecycle revisions`)
      }
      const clarificationKey = clarificationReviewGroupKey(
        artifact.conceptId,
        artifact.contentVersion,
        artifact.misconceptionTheme,
      )
      if (activeClarificationKeys.has(clarificationKey)) {
        throw new Error(
          `Clarification ${artifact.id} duplicates a version-exact active identity`,
        )
      }
      activeClarificationKeys.add(clarificationKey)
      continue
    }

    const pack = catalog.get(artifact.conceptId)
    if (!pack)
      throw new Error(`Review Artifact ${artifact.id} references an unknown Concept`)
    if (artifact.updatedAt < artifact.createdAt)
      throw new Error(`Remediation ${artifact.id} has invalid display timestamps`)
    if (
      artifact.createdRevision > artifact.updatedRevision
      || artifact.updatedRevision > snapshot.revision
    ) {
      throw new Error(`Remediation ${artifact.id} has invalid lifecycle revisions`)
    }
    const hasDiagnostic = artifact.misconceptionTheme !== null
      && artifact.markdown !== null
    const freshPendingDiagnostic = artifact.diagnosticStatus === 'pending'
      && artifact.diagnosticAttempts === 0
      && artifact.diagnosticFailure === null
      && artifact.nextDiagnosticAttemptAt === null
    const scheduledPendingDiagnostic = artifact.diagnosticStatus === 'pending'
      && artifact.diagnosticAttempts > 0
      && artifact.diagnosticAttempts < MAX_REMEDIATION_DIAGNOSTIC_ATTEMPTS
      && artifact.diagnosticFailure !== null
      && artifact.nextDiagnosticAttemptAt !== null
    const terminalDiagnosticFailure = artifact.diagnosticStatus === 'failed'
      && (
        (
          artifact.diagnosticFailure === 'context_too_large'
          && artifact.diagnosticAttempts === 1
        )
        || (
          artifact.diagnosticFailure !== 'context_too_large'
          && artifact.diagnosticAttempts === MAX_REMEDIATION_DIAGNOSTIC_ATTEMPTS
        )
      )
      && artifact.diagnosticFailure !== null
      && artifact.nextDiagnosticAttemptAt === null
    const completedDiagnostic = artifact.diagnosticStatus === 'ready'
      && artifact.diagnosticFailure === null
      && artifact.nextDiagnosticAttemptAt === null
    if (
      (artifact.diagnosticStatus === 'ready' && !hasDiagnostic)
      || (artifact.diagnosticStatus !== 'ready' && hasDiagnostic)
      || (artifact.misconceptionTheme === null) !== (artifact.markdown === null)
    ) {
      throw new Error(`Remediation ${artifact.id} contradicts its diagnostic status`)
    }
    if (
      !freshPendingDiagnostic
      && !scheduledPendingDiagnostic
      && !terminalDiagnosticFailure
      && !completedDiagnostic
    ) {
      throw new Error(`Remediation ${artifact.id} has invalid diagnostic retry state`)
    }
    assertUniqueReferences(`Remediation ${artifact.id} attempts`, artifact.attemptIds)
    assertUniqueReferences(`Remediation ${artifact.id} evidence`, artifact.evidenceIds)
    if (artifact.attemptIds.length !== 1 || artifact.evidenceIds.length !== 1) {
      throw new Error(
        `Remediation ${artifact.id} must preserve one exact failed-attempt lineage`,
      )
    }
    const diagnosticClaim = artifact.diagnosticClaim
    if (diagnosticClaim) {
      const hasExactJobIdentity
        = diagnosticClaim.job.artifactId === artifact.id
          && diagnosticClaim.job.failedAttemptId === artifact.attemptIds[0]
          && diagnosticClaim.job.diagnosticAttempt
          === artifact.diagnosticAttempts + 1
      const claimIsDue
        = artifact.nextDiagnosticAttemptAt === null
          || artifact.nextDiagnosticAttemptAt <= diagnosticClaim.claimedAt
      if (
        artifact.diagnosticStatus !== 'pending'
        || !hasExactJobIdentity
        || !claimIsDue
        || diagnosticClaim.claimedAt !== artifact.updatedAt
      ) {
        throw new Error(
          `Remediation ${artifact.id} has a forged diagnostic claim identity`,
        )
      }
    }
    for (const attemptId of artifact.attemptIds) {
      const attempt = attempts.get(attemptId)
      const instance = attempt ? instances.get(attempt.exerciseInstanceId) : undefined
      if (
        !attempt
        || attempt.result.passed
        || !instance
        || instance.conceptId !== artifact.conceptId
        || instance.learningSkillId !== artifact.learningSkillId
        || attempt.recordedRevision > artifact.createdRevision
      ) {
        throw new Error(`Remediation ${artifact.id} must link to a failed Exercise Attempt`)
      }
      activeRemediationCountByAttempt.set(
        attemptId,
        (activeRemediationCountByAttempt.get(attemptId) ?? 0) + 1,
      )
      const hasLinkedEvidence = artifact.evidenceIds.some((evidenceId) => {
        const item = evidence.get(evidenceId)
        return item?.attemptId === attemptId && item.outcome === 'failure'
      })
      if (!hasLinkedEvidence)
        throw new Error(`Remediation ${artifact.id} is missing failure Learning Evidence`)
    }
    for (const evidenceId of artifact.evidenceIds) {
      const item = evidence.get(evidenceId)
      const linkedAttempt = item?.attemptId
        ? attempts.get(item.attemptId)
        : undefined
      if (
        !item
        || !linkedAttempt
        || item.outcome !== 'failure'
        || !item.attemptId
        || !artifact.attemptIds.includes(item.attemptId)
        || item.conceptId !== artifact.conceptId
        || item.learningSkillId !== artifact.learningSkillId
        || linkedAttempt.recordedRevision > artifact.createdRevision
      ) {
        throw new Error(`Remediation ${artifact.id} must link to failure Learning Evidence`)
      }
    }
  }

  const removedRemediationAttempts = new Set<string>()
  const activeSuppressionKeys = new Set<string>()
  for (const artifact of snapshot.removedReviewArtifacts) {
    if (
      artifact.updatedAt < artifact.createdAt
      || artifact.removedAt < artifact.updatedAt
      || (
        artifact.retentionAllowedAt !== null
        && artifact.retentionAllowedAt < artifact.removedAt
      )
    ) {
      throw new Error(
        `Removed Review Artifact ${artifact.id} has invalid display timestamps`,
      )
    }
    if (
      artifact.createdRevision > artifact.updatedRevision
      || artifact.updatedRevision >= artifact.removedRevision
      || artifact.removedRevision > snapshot.revision
    ) {
      throw new Error(
        `Removed Review Artifact ${artifact.id} has invalid lifecycle revisions`,
      )
    }
    if (
      (artifact.retentionAllowedAt === null)
      !== (artifact.retentionAllowedRevision === null)
      || artifact.suppressionActive !== (artifact.retentionAllowedRevision === null)
      || (
        artifact.retentionAllowedRevision !== null
        && (
          artifact.retentionAllowedRevision <= artifact.removedRevision
          || artifact.retentionAllowedRevision > snapshot.revision
        )
      )
    ) {
      throw new Error(
        `Removed Review Artifact ${artifact.id} contradicts its retention suppression state`,
      )
    }
    if (artifact.suppressionActive) {
      if (activeSuppressionKeys.has(artifact.suppressionKey)) {
        throw new Error(
          `Removed Review Artifact ${artifact.id} duplicates an active retention suppression`,
        )
      }
      activeSuppressionKeys.add(artifact.suppressionKey)
    }
    if (artifact.type === 'clarification') {
      if (!catalog.getVersion(artifact.conceptId, artifact.contentVersion)) {
        throw new Error(
          `Removed Clarification ${artifact.id} references unknown Content Version`,
        )
      }
      if (
        artifact.suppressionKey !== clarificationSuppressionKey(
          artifact.conceptId,
          artifact.contentVersion,
          artifact.misconceptionTheme,
        )
      ) {
        throw new Error(
          `Removed Clarification ${artifact.id} has a forged semantic suppression`,
        )
      }
      if (artifact.suppressionActive && snapshot.reviewArtifacts.some(candidate =>
        candidate.type === 'clarification'
        && clarificationSuppressionKey(
          candidate.conceptId,
          candidate.contentVersion,
          candidate.misconceptionTheme,
        ) === artifact.suppressionKey)) {
        throw new Error(
          `Removed Clarification ${artifact.id} suppresses an active Review Artifact`,
        )
      }
    }
    else {
      assertUniqueReferences(
        `Removed Remediation ${artifact.id} attempts`,
        artifact.attemptIds,
      )
      assertUniqueReferences(
        `Removed Remediation ${artifact.id} evidence`,
        artifact.evidenceIds,
      )
      if (artifact.attemptIds.length !== 1 || artifact.evidenceIds.length !== 1) {
        throw new Error(
          `Removed Remediation ${artifact.id} must preserve one exact failed-attempt lineage`,
        )
      }
      const expectedSuppressionKey = remediationSuppressionKey(
        artifact.conceptId,
        artifact.learningSkillId,
        artifact.attemptIds,
      )
      if (artifact.suppressionKey !== expectedSuppressionKey) {
        throw new Error(
          `Removed Remediation ${artifact.id} has a forged semantic suppression`,
        )
      }
      for (const attemptId of artifact.attemptIds) {
        const attempt = attempts.get(attemptId)
        const instance = attempt ? instances.get(attempt.exerciseInstanceId) : undefined
        if (
          !attempt
          || attempt.result.passed
          || !instance
          || instance.conceptId !== artifact.conceptId
          || instance.learningSkillId !== artifact.learningSkillId
          || attempt.recordedRevision > artifact.createdRevision
        ) {
          throw new Error(
            `Removed Remediation ${artifact.id} must link to a failed Exercise Attempt`,
          )
        }
        removedRemediationAttempts.add(attemptId)
      }
      for (const evidenceId of artifact.evidenceIds) {
        const item = evidence.get(evidenceId)
        const linkedAttempt = item?.attemptId
          ? attempts.get(item.attemptId)
          : undefined
        if (
          !item
          || !linkedAttempt
          || item.outcome !== 'failure'
          || !item.attemptId
          || !artifact.attemptIds.includes(item.attemptId)
          || item.conceptId !== artifact.conceptId
          || item.learningSkillId !== artifact.learningSkillId
          || linkedAttempt.recordedRevision > artifact.createdRevision
        ) {
          throw new Error(
            `Removed Remediation ${artifact.id} must link to failure Learning Evidence`,
          )
        }
      }
      if (artifact.suppressionActive && snapshot.reviewArtifacts.some(candidate =>
        candidate.type === 'remediation'
        && remediationSuppressionKey(
          candidate.conceptId,
          candidate.learningSkillId,
          candidate.attemptIds,
        ) === artifact.suppressionKey)) {
        throw new Error(
          `Removed Remediation ${artifact.id} suppresses an active Review Artifact`,
        )
      }
    }
  }

  for (const attempt of snapshot.attempts) {
    if (attempt.result.passed)
      continue
    const activeCount = activeRemediationCountByAttempt.get(attempt.id) ?? 0
    if (activeCount > 1)
      throw new Error(`Failed Exercise Attempt ${attempt.id} has duplicate Remediations`)
    if (activeCount === 0 && !removedRemediationAttempts.has(attempt.id)) {
      throw new Error(
        `Failed Exercise Attempt ${attempt.id} has no retained Remediation lifecycle`,
      )
    }
  }
}
