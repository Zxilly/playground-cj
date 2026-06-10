export type ClassroomPhase = 'orient' | 'teach' | 'practice' | 'review'

// RichText is the structured representation for sides of `compare` blocks and
// elements of `steps`. Spans are discriminated on `type`. Body/prompt fields
// elsewhere are plain markdown strings.
export type RichTextSpan
  = | { type: 'text', text: string }
    | { type: 'code', code: string, lang?: string }
    | { type: 'strong', text: string }

export type RichText = RichTextSpan[]

export interface CodeHighlight {
  startLine: number
  endLine?: number
  label?: string
}

export type LessonContentBlock
  = | { type: 'heading', text: string, level?: 2 | 3 }
    | { type: 'paragraph', body: string }
    | { type: 'concept_card', conceptId: string, title: string, body: string }
    | { type: 'code_example', title?: string, code: string, language?: string, highlights?: CodeHighlight[] }
    | { type: 'callout', tone: 'note' | 'warning' | 'tip', title?: string, body: string }
    | { type: 'steps', title?: string, items: RichText[] }
    | { type: 'compare', leftTitle: string, left: RichText, rightTitle: string, right: RichText }

export type ExerciseMatchMode = 'exact' | 'contains' | 'regex'
export type ExerciseStatus = 'active' | 'success' | 'skip' | 'superseded'
export type ExerciseIntent = 'mainline' | 'placement_check' | 'review_check'

export interface ContentReference {
  packId: string
  contentVersion: string
  blockId: string
  conceptId: string
}

export interface ExerciseInstance {
  id: string
  templateId: string
  templateVersion: string
  skillId: string
  conceptIds: string[]
  prompt: string
  starterCode: string
  expectedOutput: string
  matchMode: ExerciseMatchMode
  status: ExerciseStatus
  intent: ExerciseIntent
  personalizationInputs: {
    summary: string
    difficulty?: 1 | 2 | 3 | 4 | 5
  }
  createdAt: number
}

export type EvidenceOutcome = 'success' | 'failure' | 'skip' | 'self_report'
export type EvidenceStrength = 'independent' | 'aided' | 'self_report' | 'mastery' | 'stale'

export interface LearningEvidence {
  evidenceId: string
  skillId: string
  conceptIds: string[]
  exerciseInstanceId?: string
  exerciseIntent?: ExerciseIntent
  outcome: EvidenceOutcome
  strength: EvidenceStrength
  summary: string
  createdAt: number
  runResultId?: string
}

export type ConceptStatus = 'unseen' | 'seen' | 'practicing' | 'demonstrated' | 'mastered' | 'blocked' | 'stale'

export type ReviewExposureStatus = 'seen' | 'skipped' | 'unseen'

export interface ReviewExposure {
  blockId: string
  conceptId: string
  contentVersion: string
  status: ReviewExposureStatus
  updatedAt: number
}

export type ReviewArtifactKind = 'clarification' | 'read_only_clarification' | 'remediation'

export interface ReviewArtifact {
  artifactId: string
  kind: ReviewArtifactKind
  conceptId: string
  skillId?: string
  title: string
  body: string
  summary: string
  evidenceIds: string[]
  createdAt: number
  removedAt?: number
}

export interface LearnerState {
  evidence: LearningEvidence[]
  reviewExposures: Record<string, ReviewExposure>
  reviewArtifacts: ReviewArtifact[]
}

export type ExerciseAttemptMode = 'run' | 'submit'
export type RunFailureKind = 'runner_unavailable'

export interface RunResult {
  ok: boolean
  stdout: string
  stderr: string
  exitCode: number | null
  durationMs?: number
  compilerOutput?: string
  attemptMode?: ExerciseAttemptMode
  failureKind?: RunFailureKind
}

export type ChatIntentKind = 'advance' | 'go_deeper' | 'slow_down' | 'change_topic' | 'explain_error' | 'review_check'

export type ClassroomEvent
  = | { type: 'classroom_opened', createdAt: number, summary?: string, requestedConceptId?: string }
    | { type: 'exercise_success', exerciseInstanceId: string, exerciseIntent?: ExerciseIntent, skillId: string, conceptIds: string[], summary: string, createdAt: number }
    | { type: 'exercise_skip', exerciseInstanceId: string, exerciseIntent?: ExerciseIntent, skillId: string, conceptIds: string[], summary: string, createdAt: number }
    | { type: 'exercise_failure', exerciseInstanceId: string, exerciseIntent?: ExerciseIntent, templateId: string, skillId: string, conceptIds: string[], prompt: string, attemptedCode: string, expectedOutput: string, actualOutput: string, summary: string, createdAt: number }
    | { type: 'chat_intent', intent: ChatIntentKind, summary: string, activeConceptId?: string, createdAt: number }
    | { type: 'lesson_generation_error', summary: string, createdAt: number }

export type ClassroomStreamItem
  = | { id: string, type: 'content_reference_group', groupId: string, conceptId: string, skillId?: string, title?: string, references: ContentReference[], createdAt: number }
    | { id: string, type: 'bridge_note', conceptIds: string[], body: string, createdAt: number }
    | { id: string, type: 'skip_marker', conceptId: string, blockIds: string[], reason: string, createdAt: number }
    | { id: string, type: 'exercise_instance', exercise: ExerciseInstance, createdAt: number }
    | { id: string, type: 'run_result', exerciseInstanceId?: string, result: RunResult, matched?: boolean, createdAt: number }
    | { id: string, type: 'learning_evidence_marker', evidenceId: string, conceptId: string, skillId: string, exerciseIntent?: ExerciseIntent, outcome: EvidenceOutcome, strength: EvidenceStrength, summary: string, createdAt: number }
    | { id: string, type: 'retention_marker', artifactId: string, conceptId: string, kind: ReviewArtifactKind, summary: string, createdAt: number }
    | { id: string, type: 'system_event', event: ClassroomEvent, createdAt: number }

export interface TrackAdjustment {
  adjustmentId: string
  kind: 'topic_entry' | 'focused_catch_up' | 'skip_ahead' | 'review'
  conceptId?: string
  summary: string
  createdAt: number
}

export interface ClassroomTrackState {
  activeTrackId: string
  targetConceptId: string | null
  targetSkillId: string | null
  adjustments: TrackAdjustment[]
}

export interface ClassroomSession {
  version: 3
  lang: string
  phase: ClassroomPhase
  contentPackId: string
  contentVersion: string
  stream: ClassroomStreamItem[]
  learner: LearnerState
  currentExercise: ExerciseInstance | null
  lastRun: RunResult | null
  sessionSummary: string
  eventQueue: ClassroomEvent[]
  track: ClassroomTrackState
}
