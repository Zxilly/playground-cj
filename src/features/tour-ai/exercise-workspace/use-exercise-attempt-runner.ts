'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ClassroomAction } from '@/lib/ai/classroom/reducer'
import { evaluateExerciseOutput } from '@/lib/ai/classroom/reducer'
import type { ExerciseAttemptMode, ExerciseInstance, RunResult } from '@/lib/ai/classroom/types'
import { useCodeSuggestionStore } from '@/features/tour-ai/state/code-suggestion-store'
import { useClassroomActivity } from '@/features/tour-ai/context/classroom-activity-context'
import type { MonacoEditorHandle } from '@/modules/cangjie-editor/components/EditorWrapper'
import { requestRemoteAction } from '@/service/run'

export type { ExerciseAttemptMode } from '@/lib/ai/classroom/types'

export interface ExerciseFeedback {
  mode: ExerciseAttemptMode
  matched: boolean
  result: RunResult
  attemptedCode?: string
}

export function useExerciseAttemptRunner({
  exercise,
  editorHandle,
  dispatch,
  onResult,
}: {
  exercise: ExerciseInstance
  editorHandle?: MonacoEditorHandle
  dispatch: React.Dispatch<ClassroomAction>
  onResult: () => void
}) {
  const [busyMode, setBusyMode] = useState<ExerciseAttemptMode | null>(null)
  const [feedback, setFeedback] = useState<ExerciseFeedback | null>(null)
  const { beginRunnerRun, endRunnerRun } = useClassroomActivity()
  const mountedRef = useRef(true)
  const runningRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const finishAttempt = useCallback((mode: ExerciseAttemptMode, result: RunResult, attemptedCode: string) => {
    const matched = result.ok && evaluateExerciseOutput(exercise, result.stdout).matched
    setFeedback({ mode, matched, result, attemptedCode })
    onResult()

    if (mode === 'submit') {
      const attempt = useCodeSuggestionStore.getState().getAttemptEvidence(exercise.id)
      dispatch({
        type: 'EXERCISE_SUBMIT_FINISHED',
        result,
        attemptedCode,
        ...(attempt ? { attempt } : {}),
        now: Date.now(),
      })
      return
    }

    dispatch({
      type: 'EXERCISE_RUN_FINISHED',
      result,
      attemptedCode,
      now: Date.now(),
    })
  }, [dispatch, exercise, onResult])

  const runExercise = useCallback(async (mode: ExerciseAttemptMode) => {
    if (runningRef.current || !editorHandle)
      return
    const model = editorHandle.getEditor()?.getModel()
    if (!model)
      return
    runningRef.current = true
    setBusyMode(mode)
    beginRunnerRun(exercise.id)
    const attemptedCode = model.getValue()
    try {
      const data = await requestRemoteAction(attemptedCode, 'run')
      const result: RunResult = {
        ok: data.compiler_code === 0 && data.bin_code === 0,
        stdout: data.bin_output,
        stderr: data.compiler_output,
        exitCode: data.bin_code,
      }
      if (!mountedRef.current)
        return
      finishAttempt(mode, result, attemptedCode)
    }
    catch (error) {
      if (!mountedRef.current)
        return
      finishAttempt(mode, {
        ok: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: null,
        failureKind: 'runner_unavailable',
      }, attemptedCode)
    }
    finally {
      runningRef.current = false
      if (mountedRef.current)
        setBusyMode(null)
      endRunnerRun(exercise.id)
    }
  }, [beginRunnerRun, editorHandle, endRunnerRun, exercise.id, finishAttempt])

  return {
    busyMode,
    busy: busyMode !== null,
    feedback,
    runExercise,
  }
}
