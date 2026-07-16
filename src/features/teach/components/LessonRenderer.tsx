'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import type { Block } from '@/lib/teach/lessons/blocks'
import type { Lesson } from '@/lib/teach/lessons/lesson'
import type { RunResult } from '@/lib/teach/feedback/run-cangjie'
import type { ActiveEditorRegistry } from '@/features/teach/state/active-editor-store'
import type { RecordBlockOutcome, RetrievalStoreLike } from '@/features/teach/hooks/use-block-outcome'
import { useBlockOutcome } from '@/features/teach/hooks/use-block-outcome'
import { lessonEditorUriHint, lessonModelScope } from '@/lib/monaco/model-identity'
import { retainModelScope } from '@/lib/monaco/model-lifecycle'
import type { BlockOutcomeReport } from './blocks/block-props'
import { ProseBlock } from './blocks/ProseBlock'
import { HeadingBlock } from './blocks/HeadingBlock'
import { CalloutBlock } from './blocks/CalloutBlock'
import { CodeSampleBlock } from './blocks/CodeSampleBlock'
import { GlossaryRefBlock } from './blocks/GlossaryRefBlock'
import { QuizBlock } from './blocks/QuizBlock'
import { RecallPromptBlock } from './blocks/RecallPromptBlock'
import { CodeTaskBlock } from './blocks/CodeTaskBlock'
import { OJBlock } from './blocks/OJBlock'
import { LessonLinkBlock } from './blocks/LessonLinkBlock'
import { ReferenceLinkBlock } from './blocks/ReferenceLinkBlock'
import { FollowupPromptBlock } from './blocks/FollowupPromptBlock'
import { RawHtmlSandbox } from './blocks/RawHtmlSandbox'

/** Deterministic per-block id keyed by position, matching `blockProgress` keys. */
function blockId(index: number): string {
  return `b${index}`
}

export interface LessonRendererProps {
  lesson: Lesson
  /**
   * Atomically commit one block's outcome into the lesson's progress (the shell
   * wires this to `repo.recordBlockOutcome(lesson.id, …)`).
   */
  record: RecordBlockOutcome
  /** Spaced-retrieval schedule store, fed by quiz/recall outcomes. */
  retrievalStore: RetrievalStoreLike
  /** Injected clock; never reads `Date.now()` directly. */
  now: () => number
  /**
   * Optional runner for interactive blocks (code_task, raw_html sandbox). When
   * omitted, code_task falls back to its own default remote runner and the
   * raw_html bridge `teach:run` no-ops.
   */
  runCode?: (code: string) => Promise<RunResult>
  /**
   * Optional runner for the `oj` block. Mirrors {@link runCode} but accepts
   * per-test-case `stdin` (and an abort signal) so an online-judge problem can
   * feed each test case's input to the compiled program. When omitted the oj
   * block falls back to its own default remote runner.
   */
  runProgram?: (code: string, opts?: { stdin?: string, signal?: AbortSignal }) => Promise<RunResult>
  /**
   * Grade a recall_prompt free-text answer with the learner's configured LLM,
   * returning whether the answer is correct plus feedback to show. When omitted
   * the recall block falls back to learner self-grading.
   */
  gradeRecall?: (params: { prompt: string, reference: string, answer: string }) => Promise<{ correct: boolean, feedback: string }>
  /**
   * Registry each `code_task` editor registers itself with while mounted, so the
   * teacher's editor tools read/write the learner's active code_task. Optional so
   * document-only previews can omit it.
   */
  activeEditor?: ActiveEditorRegistry
  /** UI locale forwarded to the code_task Monaco editor. */
  locale?: string
}

interface RenderBlockArgs {
  block: Block | { type: string }
  index: number
  outcome: Lesson['state']['blockProgress'][string] | undefined
  onOutcome: (report: BlockOutcomeReport) => void
  runCode?: (code: string) => Promise<RunResult>
  runProgram?: (code: string, opts?: { stdin?: string, signal?: AbortSignal }) => Promise<RunResult>
  gradeRecall?: (params: { prompt: string, reference: string, answer: string }) => Promise<{ correct: boolean, feedback: string }>
  activeEditor?: ActiveEditorRegistry
  locale?: string
  editorUriHint?: string
  editorModelScope?: string
}

/**
 * Dispatch a single block to its component. Unknown types (e.g. a block authored
 * by a newer client version) degrade to a non-fabricating placeholder and log a
 * warning rather than crashing the whole lesson.
 */
function renderBlock({ block, outcome, onOutcome, runCode, runProgram, gradeRecall, activeEditor, locale, editorUriHint, editorModelScope }: RenderBlockArgs) {
  switch (block.type) {
    case 'prose':
      return <ProseBlock block={block as Extract<Block, { type: 'prose' }>} outcome={outcome} />
    case 'heading':
      return <HeadingBlock block={block as Extract<Block, { type: 'heading' }>} outcome={outcome} />
    case 'callout':
      return <CalloutBlock block={block as Extract<Block, { type: 'callout' }>} outcome={outcome} />
    case 'code_sample':
      return <CodeSampleBlock block={block as Extract<Block, { type: 'code_sample' }>} outcome={outcome} />
    case 'glossary_ref':
      return <GlossaryRefBlock block={block as Extract<Block, { type: 'glossary_ref' }>} outcome={outcome} />
    case 'quiz':
      return <QuizBlock block={block as Extract<Block, { type: 'quiz' }>} outcome={outcome} onOutcome={onOutcome} />
    case 'recall_prompt':
      return <RecallPromptBlock block={block as Extract<Block, { type: 'recall_prompt' }>} outcome={outcome} onOutcome={onOutcome} gradeRecall={gradeRecall} />
    case 'code_task':
      return (
        <CodeTaskBlock
          block={block as Extract<Block, { type: 'code_task' }>}
          outcome={outcome}
          onOutcome={onOutcome}
          runCode={runCode}
          activeEditor={activeEditor}
          locale={locale}
          editorUriHint={editorUriHint}
          editorModelScope={editorModelScope}
        />
      )
    case 'oj':
      return (
        <OJBlock
          block={block as Extract<Block, { type: 'oj' }>}
          outcome={outcome}
          onOutcome={onOutcome}
          runProgram={runProgram}
          activeEditor={activeEditor}
          locale={locale}
          editorUriHint={editorUriHint}
          editorModelScope={editorModelScope}
        />
      )
    case 'lesson_link':
      return <LessonLinkBlock block={block as Extract<Block, { type: 'lesson_link' }>} outcome={outcome} />
    case 'reference_link':
      return <ReferenceLinkBlock block={block as Extract<Block, { type: 'reference_link' }>} outcome={outcome} />
    case 'followup_prompt':
      return <FollowupPromptBlock block={block as Extract<Block, { type: 'followup_prompt' }>} outcome={outcome} />
    case 'raw_html':
      return (
        <RawHtmlSandbox
          block={block as Extract<Block, { type: 'raw_html' }>}
          outcome={outcome}
          onRun={runCode ? code => void runCode(code) : undefined}
        />
      )
    default:
      console.warn(`[teach] Unknown lesson block type "${block.type}"; rendering a placeholder.`)
      return (
        <div
          data-testid="unknown-block"
          className="flex items-start gap-2 rounded-md border border-dashed border-amber-400/60 bg-amber-50/40 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            <Trans>这个内容块无法显示（类型未知）。请向老师反馈。</Trans>
          </span>
        </div>
      )
  }
}

/**
 * Render an ordered lesson: dispatch each block to its component and wire
 * interactive outcomes (quiz / recall / code_task) back into the lesson state
 * and the spaced-retrieval schedule via {@link useBlockOutcome}. Each block is
 * keyed by lesson plus position. The position (`b{index}`) still matches
 * `lesson.state.blockProgress`, while the lesson prefix forces editor state to
 * remount when the same renderer switches to a different lesson.
 */
export function LessonRenderer({ lesson, record, retrievalStore, now, runCode, runProgram, gradeRecall, activeEditor, locale }: LessonRendererProps) {
  const editorModelScope = lessonModelScope(lesson.id)
  useEffect(() => retainModelScope(editorModelScope), [editorModelScope])

  const onBlockOutcome = useBlockOutcome({
    lessonId: lesson.id,
    state: lesson.state,
    record,
    retrievalStore,
    now,
  })

  return (
    <article data-testid="lesson-renderer" className="flex flex-col gap-4">
      {lesson.blocks.map((block, index) => {
        const id = blockId(index)
        return (
          <div key={`${lesson.id}:${id}`} data-block-index={index} data-block-type={block.type}>
            {renderBlock({
              block,
              index,
              outcome: lesson.state.blockProgress[id],
              onOutcome: report => void onBlockOutcome(id, block.type, report),
              runCode,
              runProgram,
              gradeRecall,
              activeEditor,
              locale,
              editorUriHint: lessonEditorUriHint(lesson.id, id),
              editorModelScope,
            })}
          </div>
        )
      })}
    </article>
  )
}
