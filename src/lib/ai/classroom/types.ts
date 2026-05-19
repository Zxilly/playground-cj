export type ClassroomPhase = 'orient' | 'teach' | 'practice'

// RichText is the structured representation for sides of `compare` blocks and
// elements of `steps`. Spans are discriminated on `type`. Body/prompt fields
// elsewhere are plain markdown strings — see markdownBodySchema.
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
    | { type: 'quiz', conceptId: string, prompt: string, starterCode: string, expectedOutput: string, matchMode?: QuizMatchMode }

export type QuizMatchMode = 'exact' | 'contains' | 'regex'
export type QuizStatus = 'active' | 'success' | 'skip' | 'superseded'

export interface ClassroomQuiz {
  id: string
  conceptId: string
  prompt: string
  starterCode: string
  expectedOutput: string
  matchMode: QuizMatchMode
  status: QuizStatus
  createdAt: number
}

export type EvidenceOutcome = 'success' | 'skip'

export interface Evidence {
  conceptId: string
  outcome: EvidenceOutcome
  source: 'quiz'
  summary: string
  createdAt: number
}

export type ConceptStatus = 'unseen' | 'introduced' | 'practicing' | 'demonstrated'

export interface ConceptState {
  conceptId: string
  status: ConceptStatus
  notes?: string
  updatedAt: number
}

export interface LearnerState {
  concepts: Record<string, ConceptState>
  evidence: Evidence[]
  learningNotes: string
}

export interface RunResult {
  ok: boolean
  stdout: string
  stderr: string
  exitCode: number | null
  durationMs?: number
  compilerOutput?: string
}

export type ChatIntentKind = 'advance' | 'go_deeper' | 'slow_down' | 'change_topic' | 'explain_error'

export type ClassroomEvent
  = | { type: 'classroom_opened', createdAt: number, summary?: string }
    | { type: 'quiz_success', conceptId: string, summary: string, createdAt: number }
    | { type: 'quiz_skip', conceptId: string, summary: string, createdAt: number }
    | { type: 'quiz_failure', conceptId: string, quizId: string, prompt: string, attemptedCode: string, expectedOutput: string, actualOutput: string, summary: string, createdAt: number }
    | { type: 'chat_intent', intent: ChatIntentKind, summary: string, createdAt: number }
    | { type: 'lesson_generation_error', summary: string, createdAt: number }

export type ClassroomStreamItem
  = | { id: string, type: 'lesson_blocks', blocks: LessonContentBlock[], createdAt: number }
    | { id: string, type: 'quiz', quiz: ClassroomQuiz, createdAt: number }
    | { id: string, type: 'run_result', result: RunResult, matched?: boolean, createdAt: number }
    | { id: string, type: 'progress_update', conceptId: string, outcome: EvidenceOutcome, summary: string, createdAt: number }
    | { id: string, type: 'system_event', event: ClassroomEvent, createdAt: number }

export interface ClassroomSession {
  version: 2
  lang: string
  phase: ClassroomPhase
  stream: ClassroomStreamItem[]
  learner: LearnerState
  currentQuiz: ClassroomQuiz | null
  lastRun: RunResult | null
  sessionSummary: string
  eventQueue: ClassroomEvent[]
}
