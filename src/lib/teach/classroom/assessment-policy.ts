import type {
  ClassroomSnapshot,
  ExerciseAssistanceEvent,
  ExerciseAttempt,
  ExerciseInstance,
  LearningEvidence,
} from './state'
import { canonicalJson } from './canonical-json'
import {
  assessmentContractFingerprint,
} from './content-packs'

interface IndexedAssistance {
  event: ExerciseAssistanceEvent
  ordinal: number
}

interface AssessmentScopeHistory {
  assistanceByTemplate: Map<string, IndexedAssistance[]>
  assistanceByFingerprint: Map<string, IndexedAssistance[]>
  assistanceByTaskType: Map<string, IndexedAssistance[]>
  ambiguousCodeAssistance: IndexedAssistance[]
  earliestAttemptRevisionByTemplate: Map<string, number>
  earliestAttemptRevisionByFingerprint: Map<string, number>
  earliestAttemptRevisionByTaskType: Map<string, number>
  earliestAmbiguousCodeAttemptRevision: number | undefined
}

interface InstanceContract {
  scopeKey: string
  templateId: string
  fingerprint: string
  taskType: ExerciseInstance['task']['type']
  ambiguousCode: boolean
}

export interface AssessmentHistoryIndex {
  applicableAssistance: (
    instance: ExerciseInstance,
    beforeRevision: number,
  ) => ExerciseAssistanceEvent[]
  wasPreviouslyAttempted: (
    instance: ExerciseInstance,
    beforeRevision: number,
  ) => boolean
  expectedEvidenceType: (
    instance: ExerciseInstance,
    attempt: Pick<ExerciseAttempt, 'assistance' | 'recordedRevision'>,
  ) => LearningEvidence['type']
  projectCurrentEligibility: (
    instance: ExerciseInstance,
  ) => AssessmentEligibilityProjection
}

export interface AssessmentEligibilityProjection {
  applicableAssistanceEventIds: string[]
  applicableAssistanceEventCount: number
  applicableAssistanceEventIdsTruncated: boolean
  applicableAssistanceTypes: ExerciseAssistanceEvent['type'][]
  teacherExposureActive: boolean
  assessmentPreviouslyAttempted: boolean
  expectedNextAssistance: ExerciseAttempt['assistance']
  expectedNextEvidenceType: LearningEvidence['type']
}

export const MAX_ELIGIBILITY_ASSISTANCE_EVENT_IDS = 32

function instanceContract(instance: ExerciseInstance): InstanceContract {
  return {
    scopeKey: canonicalJson([instance.conceptId, instance.learningSkillId]),
    templateId: instance.templateId,
    fingerprint: assessmentContractFingerprint(instance.task),
    taskType: instance.task.type,
    ambiguousCode: instance.task.type === 'code_output'
      && instance.task.matchMode !== 'exact',
  }
}

function createScopeHistory(): AssessmentScopeHistory {
  return {
    assistanceByTemplate: new Map(),
    assistanceByFingerprint: new Map(),
    assistanceByTaskType: new Map(),
    ambiguousCodeAssistance: [],
    earliestAttemptRevisionByTemplate: new Map(),
    earliestAttemptRevisionByFingerprint: new Map(),
    earliestAttemptRevisionByTaskType: new Map(),
    earliestAmbiguousCodeAttemptRevision: undefined,
  }
}

function appendToIndex<T>(
  index: Map<string, T[]>,
  key: string,
  value: T,
): void {
  const values = index.get(key)
  if (values)
    values.push(value)
  else
    index.set(key, [value])
}

function recordEarliestRevision(
  index: Map<string, number>,
  key: string,
  revision: number,
): void {
  const current = index.get(key)
  if (current === undefined || revision < current)
    index.set(key, revision)
}

function mergeApplicableAssistance(
  matchGroups: readonly (readonly IndexedAssistance[])[],
  beforeRevision: number,
): ExerciseAssistanceEvent[] {
  const matchesByOrdinal = new Map<number, ExerciseAssistanceEvent>()
  const prefixLengthBeforeRevision = (
    matches: readonly IndexedAssistance[],
  ): number => {
    let lower = 0
    let upper = matches.length
    while (lower < upper) {
      const middle = lower + Math.floor((upper - lower) / 2)
      if (matches[middle]!.event.recordedRevision < beforeRevision)
        lower = middle + 1
      else
        upper = middle
    }
    return lower
  }
  for (const matches of matchGroups) {
    const limit = prefixLengthBeforeRevision(matches)
    for (let index = 0; index < limit; index++) {
      const match = matches[index]!
      matchesByOrdinal.set(match.ordinal, match.event)
    }
  }
  return [...matchesByOrdinal.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, event]) => event)
}

/**
 * Build the immutable lookup used by both command handling and full integrity
 * validation. Construction is O(stream + assistance + attempts); subsequent
 * freshness checks are O(1), and assistance queries are proportional to the
 * matching events they must return.
 */
export function createAssessmentHistoryIndex(
  snapshot: ClassroomSnapshot,
): AssessmentHistoryIndex {
  const contractsByInstanceId = new Map<string, InstanceContract>()
  const histories = new Map<string, AssessmentScopeHistory>()

  for (const entry of snapshot.stream) {
    if (entry.type !== 'exercise_instance')
      continue
    const contract = instanceContract(entry)
    contractsByInstanceId.set(entry.id, contract)
    if (!histories.has(contract.scopeKey))
      histories.set(contract.scopeKey, createScopeHistory())
  }

  snapshot.assistanceEvents.forEach((event, ordinal) => {
    const contract = contractsByInstanceId.get(event.exerciseInstanceId)
    const history = contract ? histories.get(contract.scopeKey) : undefined
    if (!contract || !history)
      return
    const indexed = { event, ordinal }
    appendToIndex(history.assistanceByTemplate, contract.templateId, indexed)
    appendToIndex(
      history.assistanceByFingerprint,
      contract.fingerprint,
      indexed,
    )
    appendToIndex(history.assistanceByTaskType, contract.taskType, indexed)
    if (contract.ambiguousCode)
      history.ambiguousCodeAssistance.push(indexed)
  })

  for (const attempt of snapshot.attempts) {
    const contract = contractsByInstanceId.get(attempt.exerciseInstanceId)
    const history = contract ? histories.get(contract.scopeKey) : undefined
    if (!contract || !history)
      continue
    recordEarliestRevision(
      history.earliestAttemptRevisionByTemplate,
      contract.templateId,
      attempt.recordedRevision,
    )
    recordEarliestRevision(
      history.earliestAttemptRevisionByFingerprint,
      contract.fingerprint,
      attempt.recordedRevision,
    )
    recordEarliestRevision(
      history.earliestAttemptRevisionByTaskType,
      contract.taskType,
      attempt.recordedRevision,
    )
    if (
      contract.ambiguousCode
      && (
        history.earliestAmbiguousCodeAttemptRevision === undefined
        || attempt.recordedRevision
        < history.earliestAmbiguousCodeAttemptRevision
      )
    ) {
      history.earliestAmbiguousCodeAttemptRevision = attempt.recordedRevision
    }
  }

  const contractFor = (instance: ExerciseInstance): InstanceContract =>
    contractsByInstanceId.get(instance.id) ?? instanceContract(instance)

  const applicableAssistance = (
    instance: ExerciseInstance,
    beforeRevision: number,
  ): ExerciseAssistanceEvent[] => {
    const contract = contractFor(instance)
    const history = histories.get(contract.scopeKey)
    if (!history)
      return []
    const matches: IndexedAssistance[][] = [
      history.assistanceByTemplate.get(contract.templateId) ?? [],
    ]
    if (contract.ambiguousCode) {
      matches.push(
        history.assistanceByTaskType.get(contract.taskType) ?? [],
      )
    }
    else {
      matches.push(
        history.assistanceByFingerprint.get(contract.fingerprint) ?? [],
      )
      if (contract.taskType === 'code_output')
        matches.push(history.ambiguousCodeAssistance)
    }
    return mergeApplicableAssistance(
      matches,
      beforeRevision,
    )
  }

  const wasPreviouslyAttempted = (
    instance: ExerciseInstance,
    beforeRevision: number,
  ): boolean => {
    const contract = contractFor(instance)
    const history = histories.get(contract.scopeKey)
    if (!history)
      return false
    const templateRevision
      = history.earliestAttemptRevisionByTemplate.get(contract.templateId)
    const fingerprintRevision
      = history.earliestAttemptRevisionByFingerprint.get(contract.fingerprint)
    const candidateRevisions = [templateRevision]
    if (contract.ambiguousCode) {
      candidateRevisions.push(
        history.earliestAttemptRevisionByTaskType.get(contract.taskType),
      )
    }
    else {
      candidateRevisions.push(fingerprintRevision)
      if (contract.taskType === 'code_output') {
        candidateRevisions.push(
          history.earliestAmbiguousCodeAttemptRevision,
        )
      }
    }
    return candidateRevisions.some(revision =>
      revision !== undefined && revision < beforeRevision)
  }

  return {
    applicableAssistance,
    wasPreviouslyAttempted,
    expectedEvidenceType: (instance, attempt) => {
      if (attempt.assistance !== 'none')
        return 'aided'
      return wasPreviouslyAttempted(instance, attempt.recordedRevision)
        ? 'practice'
        : 'independent'
    },
    projectCurrentEligibility: (instance) => {
      const beforeRevision = snapshot.revision + 1
      const assistance = applicableAssistance(instance, beforeRevision)
      const teacherExposureActive = snapshot.teacherExposureEpoch !== null
        && snapshot.teacherExposureEpoch.recordedRevision < beforeRevision
      const expectedNextAssistance
        = teacherExposureActive
          ? 'teacher_exposure'
          : assistance.length > 0
            ? 'hint'
            : 'none'
      const assessmentPreviouslyAttempted = wasPreviouslyAttempted(
        instance,
        beforeRevision,
      )
      return {
        applicableAssistanceEventIds: assistance
          .slice(-MAX_ELIGIBILITY_ASSISTANCE_EVENT_IDS)
          .map(event => event.id),
        applicableAssistanceEventCount: assistance.length,
        applicableAssistanceEventIdsTruncated:
          assistance.length > MAX_ELIGIBILITY_ASSISTANCE_EVENT_IDS,
        applicableAssistanceTypes: [...new Set(
          assistance.map(event => event.type),
        )],
        teacherExposureActive,
        assessmentPreviouslyAttempted,
        expectedNextAssistance,
        expectedNextEvidenceType: expectedNextAssistance !== 'none'
          ? 'aided'
          : assessmentPreviouslyAttempted
            ? 'practice'
            : 'independent',
      }
    },
  }
}
