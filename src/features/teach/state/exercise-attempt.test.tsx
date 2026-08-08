import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AIClassroom } from '@/lib/teach/classroom/ai-classroom'
import { useExerciseAttempt } from './exercise-attempt'

describe('useExerciseAttempt', () => {
  it('owns the attempt id and busy state while recording a prepared attempt', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const execute = vi.fn(async () => {
      await gate
      return {} as Awaited<ReturnType<AIClassroom['execute']>>
    })
    const classroom = { execute } as Pick<AIClassroom, 'execute'>
    const { result } = renderHook(() => useExerciseAttempt({
      classroom,
      exerciseInstanceId: 'exercise:one',
      createId: () => 'attempt:one',
    }))

    let submission!: Promise<void>
    act(() => {
      submission = result.current.submit(() => ({
        submission: { type: 'recall', answer: 'main is the entry point' },
      }))
    })

    expect(result.current.busy).toBe(true)
    expect(result.current.error).toBeNull()

    await act(async () => {
      release()
      await submission
    })

    expect(execute).toHaveBeenCalledWith({
      type: 'record_exercise_attempt',
      attemptId: 'attempt:one',
      exerciseInstanceId: 'exercise:one',
      submission: { type: 'recall', answer: 'main is the entry point' },
    })
    expect(result.current.busy).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('surfaces preparation failures without recording an attempt', async () => {
    const execute = vi.fn()
    const classroom = { execute } as unknown as Pick<AIClassroom, 'execute'>
    const { result } = renderHook(() => useExerciseAttempt({
      classroom,
      exerciseInstanceId: 'exercise:one',
      createId: () => 'attempt:one',
    }))

    await act(async () => {
      await result.current.submit(() => {
        throw new Error('Runner unavailable.')
      })
    })

    expect(execute).not.toHaveBeenCalled()
    expect(result.current.busy).toBe(false)
    expect(result.current.error).toBe('Runner unavailable.')
  })

  it('aborts preparation and skips recording when its owner unmounts', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let preparationSignal!: AbortSignal
    const execute = vi.fn()
    const classroom = { execute } as unknown as Pick<AIClassroom, 'execute'>
    const { result, unmount } = renderHook(() => useExerciseAttempt({
      classroom,
      exerciseInstanceId: 'exercise:one',
      createId: () => 'attempt:one',
    }))

    let submission!: Promise<void>
    act(() => {
      submission = result.current.submit(async (signal) => {
        preparationSignal = signal
        await gate
        return { submission: { type: 'recall', answer: 'answer' } }
      })
    })
    unmount()

    expect(preparationSignal.aborted).toBe(true)
    release()
    await submission
    expect(execute).not.toHaveBeenCalled()
  })

  it('abandons preparation when the rendered Exercise Instance changes', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let preparationSignal!: AbortSignal
    const execute = vi.fn()
    const classroom = { execute } as unknown as Pick<AIClassroom, 'execute'>
    const { result, rerender } = renderHook(
      ({ exerciseInstanceId }) => useExerciseAttempt({
        classroom,
        exerciseInstanceId,
        createId: () => 'attempt:one',
      }),
      { initialProps: { exerciseInstanceId: 'exercise:one' } },
    )

    let submission!: Promise<void>
    act(() => {
      submission = result.current.submit(async (signal) => {
        preparationSignal = signal
        await gate
        return { submission: { type: 'recall', answer: 'old answer' } }
      })
    })
    rerender({ exerciseInstanceId: 'exercise:two' })

    expect(preparationSignal.aborted).toBe(true)
    release()
    await submission
    expect(execute).not.toHaveBeenCalled()
  })
})
