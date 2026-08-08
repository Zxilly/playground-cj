import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  AIClassroom,
  ClassroomCommand,
} from '@/lib/teach/classroom/ai-classroom'

type RecordAttemptCommand = Extract<
  ClassroomCommand,
  { type: 'record_exercise_attempt' }
>

export type PreparedExerciseAttempt = RecordAttemptCommand extends infer Command
  ? Command extends RecordAttemptCommand
    ? Omit<Command, 'type' | 'attemptId' | 'exerciseInstanceId'>
    : never
  : never

export type PrepareExerciseAttempt = (
  signal: AbortSignal,
) => PreparedExerciseAttempt | Promise<PreparedExerciseAttempt>

export interface UseExerciseAttemptOptions {
  classroom: Pick<AIClassroom, 'execute'>
  exerciseInstanceId: string
  createId?: () => string
}

export interface ExerciseAttemptHandle {
  busy: boolean
  error: string | null
  clearError: () => void
  submit: (prepare: PrepareExerciseAttempt) => Promise<void>
}

interface ExerciseAttemptState {
  classroom: Pick<AIClassroom, 'execute'>
  exerciseInstanceId: string
  busy: boolean
  error: string | null
}

function createAttemptId(): string {
  if (typeof globalThis.crypto.randomUUID !== 'function')
    throw new Error('This browser cannot create a secure Exercise Attempt id')
  return globalThis.crypto.randomUUID()
}

export function useExerciseAttempt({
  classroom,
  createId = createAttemptId,
  exerciseInstanceId,
}: UseExerciseAttemptOptions): ExerciseAttemptHandle {
  const operationRef = useRef<AbortController | null>(null)
  const sequenceRef = useRef(0)
  const [state, setState] = useState<ExerciseAttemptState>({
    classroom,
    exerciseInstanceId,
    busy: false,
    error: null,
  })
  const clearError = useCallback(() => {
    setState(current => current.classroom === classroom
      && current.exerciseInstanceId === exerciseInstanceId
      ? { ...current, error: null }
      : current)
  }, [classroom, exerciseInstanceId])

  useEffect(() => () => {
    sequenceRef.current += 1
    operationRef.current?.abort()
    operationRef.current = null
  }, [classroom, exerciseInstanceId])

  const submit = useCallback(async (prepare: PrepareExerciseAttempt) => {
    if (operationRef.current)
      return

    const sequence = sequenceRef.current + 1
    sequenceRef.current = sequence
    const controller = new AbortController()
    operationRef.current = controller
    setState({ classroom, exerciseInstanceId, busy: true, error: null })

    try {
      const prepared = await prepare(controller.signal)
      if (controller.signal.aborted || sequenceRef.current !== sequence)
        return
      await classroom.execute({
        type: 'record_exercise_attempt',
        attemptId: createId(),
        exerciseInstanceId,
        ...prepared,
      } as RecordAttemptCommand)
    }
    catch (reason) {
      if (!controller.signal.aborted && sequenceRef.current === sequence) {
        setState({
          classroom,
          exerciseInstanceId,
          busy: false,
          error: reason instanceof Error ? reason.message : String(reason),
        })
      }
    }
    finally {
      if (sequenceRef.current === sequence) {
        operationRef.current = null
        setState(current => ({ ...current, busy: false }))
      }
    }
  }, [classroom, createId, exerciseInstanceId])

  const ownsState = state.classroom === classroom
    && state.exerciseInstanceId === exerciseInstanceId
  return {
    busy: ownsState && state.busy,
    clearError,
    error: ownsState ? state.error : null,
    submit,
  }
}
