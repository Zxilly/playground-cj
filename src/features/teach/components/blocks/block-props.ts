import type {
  Block,
  CalloutBlockSchemaType,
  CodeSampleBlockSchemaType,
  FollowupPromptBlockSchemaType,
  GlossaryRefBlockSchemaType,
  HeadingBlockSchemaType,
  LessonLinkBlockSchemaType,
  ProseBlockSchemaType,
  ReferenceLinkBlockSchemaType,
} from '@/lib/teach/lessons/blocks'
import type { BlockOutcome } from '@/lib/teach/lessons/lesson'
import type { RunResult } from '@/lib/teach/feedback/run-cangjie'
import type { ActiveEditorRegistry } from '@/features/teach/state/active-editor-store'

/**
 * Self-assessment grade used by retrieval-practice blocks (recall_prompt) and
 * forwarded to the spaced-retrieval scheduler. Mirrors the scheduler's grade.
 */
export type SelfGrade = 'again' | 'good'

/**
 * Outcome payload a block reports back to the renderer when an interactive
 * block (quiz / recall_prompt / code_task) reaches a terminal-ish state. The
 * renderer is responsible for persisting this into `lesson.state.blockProgress`
 * and (for quiz/recall) seeding/updating the retrieval schedule.
 */
export interface BlockOutcomeReport {
  /** Whether the learner's attempt was correct, when correctness applies. */
  correct?: boolean
  /** The learner's raw answer (selected indices, typed text, submitted code). */
  lastAnswer?: unknown
  /** Self-assessment grade for recall blocks. */
  grade?: SelfGrade
}

/**
 * Shared props every block component accepts. `outcome` is the previously
 * recorded progress (so a block can re-hydrate as already-completed), and
 * `onOutcome` lets interactive blocks report results upward.
 */
export interface BlockComponentProps<TBlock extends Block> {
  block: TBlock
  outcome?: BlockOutcome
  onOutcome?: (report: BlockOutcomeReport) => void
}

export type ProseBlockProps = BlockComponentProps<ProseBlockSchemaType>
export type HeadingBlockProps = BlockComponentProps<HeadingBlockSchemaType>
export type CalloutBlockProps = BlockComponentProps<CalloutBlockSchemaType>
export type CodeSampleBlockProps = BlockComponentProps<CodeSampleBlockSchemaType>
export type GlossaryRefBlockProps = BlockComponentProps<GlossaryRefBlockSchemaType>
export type LessonLinkBlockProps = BlockComponentProps<LessonLinkBlockSchemaType>
export type ReferenceLinkBlockProps = BlockComponentProps<ReferenceLinkBlockSchemaType>
export type FollowupPromptBlockProps = BlockComponentProps<FollowupPromptBlockSchemaType>

/** Props for the mixed-question quiz block. */
export type QuizBlockProps = BlockComponentProps<Extract<Block, { type: 'quiz' }>>

/**
 * Props for the OJ (online-judge) block. `runProgram` compiles and runs the
 * learner's code against a test case, optionally feeding `stdin`; mirrors how
 * CodeTaskBlock receives its runner and active-editor registry.
 */
export type OjBlockProps = BlockComponentProps<Extract<Block, { type: 'oj' }>> & {
  runProgram?: (
    code: string,
    opts?: { stdin?: string, signal?: AbortSignal },
  ) => Promise<RunResult>
  activeEditor?: ActiveEditorRegistry
  locale?: string
}

/**
 * Props for the recall-prompt block. `gradeRecall` defers free-text grading to
 * an LLM judge, returning whether the answer is correct plus feedback to show.
 */
export type RecallPromptBlockProps = BlockComponentProps<Extract<Block, { type: 'recall_prompt' }>> & {
  gradeRecall?: (params: { prompt: string, reference: string, answer: string }) => Promise<{ correct: boolean, feedback: string }>
}
