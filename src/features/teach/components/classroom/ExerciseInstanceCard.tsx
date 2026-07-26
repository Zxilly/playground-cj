'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Lightbulb, Loader2, Play, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AnsiOutput } from '@/components/AnsiOutput'
import { CompilerDiagnosticOutput } from '@/features/teach/components/blocks/CompilerDiagnosticOutput'
import { DynamicCangjieEditor } from '@/features/teach/components/editor/DynamicCangjieEditor'
import type { CangjieEditorHandle } from '@/features/teach/components/editor/CangjieEditor'
import { TeachMarkdown } from '@/features/teach/components/blocks/TeachMarkdown'
import { useActiveEditorRegistration } from '@/features/teach/hooks/use-active-editor-registration'
import { useClassroomSnapshot } from '@/features/teach/hooks/use-classroom-snapshot'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import type {
  ExerciseInstance,
  LearningEvidence,
} from '@/lib/teach/classroom/state'
import { formatRevisionLabel } from '@/lib/teach/classroom/revision-label'
import { renderPersistedDiagnostic } from '@/lib/teach/classroom/persistence-policy'

type AttemptEvidenceType = LearningEvidence['type']

function createAttemptId(): string {
  if (typeof crypto.randomUUID !== 'function')
    throw new Error('This browser cannot create a secure Exercise Attempt id')
  return crypto.randomUUID()
}

function exercisePurposeLabel(
  instance: ExerciseInstance,
  english: boolean,
): string {
  if (instance.purpose === 'placement')
    return english ? 'Placement Check' : '水平检查'
  if (instance.purpose === 'review')
    return english ? 'Review Check' : '复习检查'
  return english ? 'Practice' : '练习'
}

function difficultyLabel(
  instance: ExerciseInstance,
  english: boolean,
): string {
  const labels = english
    ? {
        standard: 'standard scaffolding',
        easy: 'guided scaffolding',
        hard: 'from-scratch scaffolding',
      }
    : {
        standard: '标准脚手架',
        easy: '引导式脚手架',
        hard: '从零脚手架',
      }
  return labels[instance.effectiveDifficulty]
}

export function ExerciseInstanceCard({ instance }: { instance: ExerciseInstance }) {
  const { activeEditor, classroom, lang, runner } = useWorkspace()
  const snapshot = useClassroomSnapshot(classroom)
  const english = lang === 'en'
  const learningTrackGoal = snapshot.tracks.find(
    track => track.id === instance.learningTrackId,
  )?.goal
  const attempts = snapshot.attempts
    .filter(attempt => attempt.exerciseInstanceId === instance.id)
    .sort((a, b) => a.createdAt - b.createdAt)
  const lastAttempt = attempts.at(-1)
  const lastEvidence = lastAttempt
    ? snapshot.evidence.find(item => item.attemptId === lastAttempt.id)
    : undefined
  const lastEvidenceType: AttemptEvidenceType | undefined = lastEvidence?.type
  const revealedHints = snapshot.assistanceEvents.filter(event =>
    event.type === 'hint' && event.exerciseInstanceId === instance.id).length

  switch (instance.task.type) {
    case 'code_output':
      return (
        <CodeOutputExercise
          instance={instance as ExerciseInstance & { task: Extract<ExerciseInstance['task'], { type: 'code_output' }> }}
          lastAttempt={lastAttempt}
          lastEvidenceType={lastEvidenceType}
          classroom={classroom}
          runner={runner}
          activeEditor={activeEditor}
          english={english}
          learningTrackGoal={learningTrackGoal}
          revealedHints={revealedHints}
        />
      )
    case 'recall':
      return (
        <RecallExercise
          instance={instance as ExerciseInstance & { task: Extract<ExerciseInstance['task'], { type: 'recall' }> }}
          lastAttempt={lastAttempt}
          lastEvidenceType={lastEvidenceType}
          classroom={classroom}
          english={english}
          learningTrackGoal={learningTrackGoal}
        />
      )
    case 'quiz':
      return (
        <QuizExercise
          instance={instance as ExerciseInstance & { task: Extract<ExerciseInstance['task'], { type: 'quiz' }> }}
          lastAttempt={lastAttempt}
          lastEvidenceType={lastEvidenceType}
          classroom={classroom}
          english={english}
          learningTrackGoal={learningTrackGoal}
        />
      )
  }
}

function shortIdentity(value: string): string {
  return value.length <= 18
    ? value
    : `${value.slice(0, 9)}…${value.slice(-6)}`
}

function ExerciseMetadata({
  english,
  instance,
  learningTrackGoal,
}: {
  english: boolean
  instance: ExerciseInstance
  learningTrackGoal: string | undefined
}) {
  const trackTitle = instance.learningTrackId === null
    ? (english ? 'No Learning Track' : '无 Learning Track')
    : learningTrackGoal
      ? `Learning Track ${instance.learningTrackId}: ${learningTrackGoal}`
      : `Learning Track ${instance.learningTrackId}`
  const visibleTrack = instance.learningTrackId === null
    ? (english ? 'Track: none' : 'Track：无')
    : learningTrackGoal
      ? `${english ? 'Track' : '路径'}: ${learningTrackGoal} · ${shortIdentity(instance.learningTrackId)}`
      : `${english ? 'Track' : '路径'}: ${shortIdentity(instance.learningTrackId)}`

  return (
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {exercisePurposeLabel(instance, english)}
        {' · '}
        {difficultyLabel(instance, english)}
      </p>
      <div className="flex min-w-0 max-w-full flex-wrap justify-end gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        <span
          className="max-w-56 truncate font-mono"
          title={`Content Version ${instance.contentVersion}`}
        >
          Content v
          {formatRevisionLabel(instance.contentVersion)}
        </span>
        <span className="max-w-72 truncate" title={trackTitle}>
          {visibleTrack}
        </span>
        <span
          className="max-w-56 truncate font-mono"
          title={`Exercise Template ${instance.templateId}@${instance.templateVersion}`}
        >
          {instance.templateId}
          @
          {formatRevisionLabel(instance.templateVersion)}
        </span>
      </div>
    </div>
  )
}

function CodeOutputExercise({
  activeEditor,
  classroom,
  english,
  instance,
  lastAttempt,
  lastEvidenceType,
  learningTrackGoal,
  revealedHints,
  runner,
}: {
  activeEditor: ReturnType<typeof useWorkspace>['activeEditor']
  classroom: ReturnType<typeof useWorkspace>['classroom']
  english: boolean
  instance: ExerciseInstance & { task: Extract<ExerciseInstance['task'], { type: 'code_output' }> }
  lastAttempt: ReturnType<typeof useClassroomSnapshot>['attempts'][number] | undefined
  lastEvidenceType: AttemptEvidenceType | undefined
  learningTrackGoal: string | undefined
  revealedHints: number
  runner: ReturnType<typeof useWorkspace>['runner']
}) {
  const initialCode = lastAttempt?.submission.type === 'code_output'
    ? lastAttempt.submission.code
    : instance.task.starterCode
  const handleRef = useRef<CangjieEditorHandle | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const sequenceRef = useRef(0)
  const [running, setRunning] = useState(false)
  const [revealingHint, setRevealingHint] = useState(false)
  const [transientError, setTransientError] = useState<string | null>(null)
  const activateEditor = useActiveEditorRegistration(activeEditor, handleRef)
  const stdout = lastAttempt?.result.stdout
    ? renderPersistedDiagnostic(lastAttempt.result.stdout)
    : ''
  const stderr = lastAttempt?.result.stderr
    ? renderPersistedDiagnostic(lastAttempt.result.stderr)
    : ''
  const compilerOutput = lastAttempt?.result.compilerOutput
    ? renderPersistedDiagnostic(lastAttempt.result.compilerOutput)
    : ''

  useEffect(() => () => controllerRef.current?.abort(), [])

  const run = async () => {
    if (running)
      return
    const code = handleRef.current?.getCode() ?? initialCode
    const sequence = sequenceRef.current + 1
    sequenceRef.current = sequence
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setRunning(true)
    setTransientError(null)
    try {
      const result = await runner.run(code, controller.signal)
      if (controller.signal.aborted || sequenceRef.current !== sequence)
        return
      if (result.failureKind === 'runner_unavailable') {
        setTransientError(result.failureMessage || (english ? 'Runner unavailable.' : '运行服务不可用。'))
        return
      }
      await classroom.execute({
        type: 'record_exercise_attempt',
        attemptId: createAttemptId(),
        exerciseInstanceId: instance.id,
        submission: { type: 'code_output', code },
        observation: { type: 'run_result', result },
      })
    }
    catch (reason) {
      if (!controller.signal.aborted)
        setTransientError(reason instanceof Error ? reason.message : String(reason))
    }
    finally {
      if (sequenceRef.current === sequence) {
        controllerRef.current = null
        setRunning(false)
      }
    }
  }

  return (
    <section data-testid="exercise-instance" className="rounded-lg border border-border bg-card p-4">
      <ExerciseMetadata
        english={english}
        instance={instance}
        learningTrackGoal={learningTrackGoal}
      />
      <div className="mt-3 text-sm font-medium leading-6">
        <TeachMarkdown markdown={instance.task.prompt} source="validated" />
      </div>
      <div
        className="mt-3 overflow-hidden rounded-md border border-border"
        onFocusCapture={activateEditor}
        onClick={activateEditor}
      >
        <DynamicCangjieEditor
          initialCode={initialCode}
          handleRef={handleRef}
          uriHint={`exercise/${instance.id}.cj`}
          modelScope={`classroom/${instance.id}`}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={running} onClick={() => void run()}>
          {running
            ? <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            : <Play aria-hidden="true" className="size-4" />}
          {running
            ? (english ? 'Running…' : '运行中…')
            : (english ? 'Run and record attempt' : '运行并记录尝试')}
        </Button>
        {revealedHints < instance.task.hints.length && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={revealingHint}
            onClick={() => {
              if (revealingHint)
                return
              setRevealingHint(true)
              setTransientError(null)
              void classroom.execute({
                type: 'record_exercise_assistance',
                exerciseInstanceId: instance.id,
                assistance: { type: 'hint', hintIndex: revealedHints },
              }).catch((reason: unknown) => {
                setTransientError(reason instanceof Error ? reason.message : String(reason))
              }).finally(() => setRevealingHint(false))
            }}
          >
            {revealingHint
              ? <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              : <Lightbulb aria-hidden="true" className="size-4" />}
            {english ? 'Show hint' : '查看提示'}
          </Button>
        )}
      </div>
      {revealedHints > 0 && (
        <ol className="mt-3 list-decimal space-y-1 ps-5 text-sm text-muted-foreground">
          {instance.task.hints.slice(0, revealedHints).map(hint => <li key={hint}>{hint}</li>)}
        </ol>
      )}
      {transientError && (
        <p role="alert" className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {transientError}
        </p>
      )}
      {lastAttempt && (
        <div className="mt-4 space-y-2 rounded-md border border-border/70 bg-muted/20 p-3">
          <p className={lastAttempt.result.passed
            ? 'flex items-center gap-2 text-sm font-semibold text-emerald-600'
            : 'flex items-center gap-2 text-sm font-semibold text-destructive'}
          >
            {lastAttempt.result.passed
              ? <CheckCircle2 aria-hidden="true" className="size-4" />
              : <XCircle aria-hidden="true" className="size-4" />}
            {lastAttempt.result.passed
              ? (english ? 'Passed' : '通过')
              : (english ? 'Not passed yet' : '尚未通过')}
          </p>
          {stdout && (
            <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-background p-2 font-mono text-xs">
              {stdout}
            </pre>
          )}
          {lastAttempt.result.stdout?.sourceTruncated && (
            <p role="status" className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
              {english ? 'Program stdout was truncated.' : '程序标准输出已截断。'}
            </p>
          )}
          {stderr && (
            <AnsiOutput text={stderr} className="font-mono text-xs" />
          )}
          {lastAttempt.result.stderr?.sourceTruncated && (
            <p role="status" className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
              {english ? 'Program stderr was truncated.' : '程序标准错误已截断。'}
            </p>
          )}
          {compilerOutput && (
            lastAttempt.result.phase === 'compile'
              ? <CompilerDiagnosticOutput output={compilerOutput} testId="exercise-compiler-output" />
              : <AnsiOutput text={compilerOutput} className="font-mono text-xs" />
          )}
          {lastAttempt.result.compilerOutput?.sourceTruncated && (
            <p role="status" className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
              {english ? 'Compiler output was truncated.' : '编译器输出已截断。'}
            </p>
          )}
          <AttemptEvidenceLabel english={english} type={lastEvidenceType} />
        </div>
      )}
    </section>
  )
}

function AttemptVerdict({
  english,
  evidenceType,
  passed,
}: {
  english: boolean
  evidenceType: AttemptEvidenceType | undefined
  passed: boolean | undefined
}) {
  if (passed === undefined)
    return null
  return (
    <div className="mt-3 space-y-1">
      <p className={passed
        ? 'flex items-center gap-2 text-sm font-semibold text-emerald-600'
        : 'flex items-center gap-2 text-sm font-semibold text-destructive'}
      >
        {passed
          ? <CheckCircle2 aria-hidden="true" className="size-4" />
          : <XCircle aria-hidden="true" className="size-4" />}
        {passed
          ? (english ? 'Passed' : '通过')
          : (english ? 'Not passed yet' : '尚未通过')}
      </p>
      <AttemptEvidenceLabel english={english} type={evidenceType} />
    </div>
  )
}

function AttemptEvidenceLabel({
  english,
  type,
}: {
  english: boolean
  type: AttemptEvidenceType | undefined
}) {
  if (!type)
    return null
  const labels: Record<AttemptEvidenceType, { en: string, zh: string }> = {
    aided: { en: 'Aided Evidence', zh: '辅助证据' },
    practice: { en: 'Practice Evidence', zh: '练习证据' },
    independent: { en: 'Independent Evidence', zh: '独立证据' },
  }
  return (
    <p className="text-xs text-muted-foreground">
      {english ? labels[type].en : labels[type].zh}
    </p>
  )
}

function RecallExercise({
  classroom,
  english,
  instance,
  lastAttempt,
  lastEvidenceType,
  learningTrackGoal,
}: {
  classroom: ReturnType<typeof useWorkspace>['classroom']
  english: boolean
  instance: ExerciseInstance & { task: Extract<ExerciseInstance['task'], { type: 'recall' }> }
  lastAttempt: ReturnType<typeof useClassroomSnapshot>['attempts'][number] | undefined
  lastEvidenceType: AttemptEvidenceType | undefined
  learningTrackGoal: string | undefined
}) {
  const previousAnswer = lastAttempt?.submission.type === 'recall'
    ? lastAttempt.submission.answer
    : ''
  const [answer, setAnswer] = useState(previousAnswer)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!answer.trim() || submitting)
      return
    setSubmitting(true)
    setError(null)
    try {
      await classroom.execute({
        type: 'record_exercise_attempt',
        attemptId: createAttemptId(),
        exerciseInstanceId: instance.id,
        submission: { type: 'recall', answer },
      })
    }
    catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    }
    finally {
      setSubmitting(false)
    }
  }

  return (
    <section data-testid="exercise-instance" className="rounded-lg border border-border bg-card p-4">
      <ExerciseMetadata
        english={english}
        instance={instance}
        learningTrackGoal={learningTrackGoal}
      />
      <div className="mt-3"><TeachMarkdown markdown={instance.task.prompt} source="validated" /></div>
      <textarea
        value={answer}
        onChange={event => setAnswer(event.target.value)}
        rows={4}
        className="mt-3 w-full resize-y rounded-md border border-input bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        aria-label={english ? 'Your answer' : '你的回答'}
      />
      <Button
        type="button"
        size="sm"
        className="mt-3"
        disabled={!answer.trim() || submitting}
        onClick={() => void submit()}
      >
        {submitting && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
        {english ? 'Submit answer' : '提交回答'}
      </Button>
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      <AttemptVerdict
        english={english}
        evidenceType={lastEvidenceType}
        passed={lastAttempt?.result.passed}
      />
    </section>
  )
}

function QuizExercise({
  classroom,
  english,
  instance,
  lastAttempt,
  lastEvidenceType,
  learningTrackGoal,
}: {
  classroom: ReturnType<typeof useWorkspace>['classroom']
  english: boolean
  instance: ExerciseInstance & { task: Extract<ExerciseInstance['task'], { type: 'quiz' }> }
  lastAttempt: ReturnType<typeof useClassroomSnapshot>['attempts'][number] | undefined
  lastEvidenceType: AttemptEvidenceType | undefined
  learningTrackGoal: string | undefined
}) {
  const previous = lastAttempt?.submission.type === 'quiz'
    ? lastAttempt.submission.answerIndices
    : instance.task.questions.map(() => [])
  const [answers, setAnswers] = useState<number[][]>(previous)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const complete = answers.every(answer => answer.length > 0)

  const toggle = (questionIndex: number, optionIndex: number, multiple: boolean) => {
    setAnswers((current) => {
      const next = current.map(answer => [...answer])
      if (!multiple) {
        next[questionIndex] = [optionIndex]
      }
      else {
        const selected = new Set(next[questionIndex])
        if (selected.has(optionIndex))
          selected.delete(optionIndex)
        else
          selected.add(optionIndex)
        next[questionIndex] = [...selected].sort((a, b) => a - b)
      }
      return next
    })
  }

  const submit = async () => {
    if (!complete || submitting)
      return
    setSubmitting(true)
    setError(null)
    try {
      await classroom.execute({
        type: 'record_exercise_attempt',
        attemptId: createAttemptId(),
        exerciseInstanceId: instance.id,
        submission: { type: 'quiz', answerIndices: answers },
      })
    }
    catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    }
    finally {
      setSubmitting(false)
    }
  }

  return (
    <section data-testid="exercise-instance" className="rounded-lg border border-border bg-card p-4">
      <ExerciseMetadata
        english={english}
        instance={instance}
        learningTrackGoal={learningTrackGoal}
      />
      <ol className="mt-3 space-y-5">
        {instance.task.questions.map((question, questionIndex) => (
          <li key={`${instance.id}:${JSON.stringify(question)}`}>
            <p className="text-sm font-medium">
              {questionIndex + 1}
              .
              {' '}
              {question.question}
            </p>
            <div className="mt-2 space-y-2">
              {question.options.map((option, optionIndex) => {
                const checked = answers[questionIndex]?.includes(optionIndex) ?? false
                return (
                  <label key={option} className="flex cursor-pointer items-start gap-2 rounded-md border border-border p-2 text-sm">
                    <input
                      type={question.multiple ? 'checkbox' : 'radio'}
                      name={`${instance.id}:${questionIndex}`}
                      checked={checked}
                      onChange={() => toggle(questionIndex, optionIndex, question.multiple)}
                    />
                    <span>{option}</span>
                  </label>
                )
              })}
            </div>
          </li>
        ))}
      </ol>
      <Button
        type="button"
        size="sm"
        className="mt-4"
        disabled={!complete || submitting}
        onClick={() => void submit()}
      >
        {submitting && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
        {english ? 'Submit answers' : '提交答案'}
      </Button>
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      <AttemptVerdict
        english={english}
        evidenceType={lastEvidenceType}
        passed={lastAttempt?.result.passed}
      />
    </section>
  )
}
