import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCodeSuggestionStore } from '@/features/tour-ai/state/code-suggestion-store'
import type { MonacoEditorHandle } from '@/modules/cangjie-editor/components/EditorWrapper'
import { useStagedCodeSuggestion } from './use-staged-code-suggestion'
import type { AppliedCodeSuggestionSnapshot } from './use-staged-code-suggestion'

function editorHandle(setValue = vi.fn(), currentCode = ''): MonacoEditorHandle {
  return {
    getEditor: () => ({
      getModel: () => ({
        getValue: () => currentCode,
        setValue,
      }),
    }) as unknown as ReturnType<MonacoEditorHandle['getEditor']>,
    dispose: () => undefined,
  }
}

describe('useStagedCodeSuggestion', () => {
  afterEach(() => {
    useCodeSuggestionStore.setState({
      suggestion: null,
      appliedAssistanceByExerciseId: {},
    })
  })

  it('clears a stale suggestion when a different exercise becomes active', () => {
    useCodeSuggestionStore.getState().setSuggestion({
      exerciseId: 'exercise:old',
      code: 'old code',
      explanation: 'Old suggestion.',
      createdAt: 1,
    })

    renderHook(() => useStagedCodeSuggestion({
      exerciseId: 'exercise:new',
      isActive: true,
      editorHandle: editorHandle(),
    }))

    expect(useCodeSuggestionStore.getState().suggestion).toBeNull()
  })

  it('does not apply or record a suggestion after its exercise becomes inactive', () => {
    const setValue = vi.fn()
    useCodeSuggestionStore.getState().setSuggestion({
      exerciseId: 'exercise:1',
      code: 'main() {}',
      explanation: 'Use this version.',
      createdAt: 1,
    })
    const { result } = renderHook(() => useStagedCodeSuggestion({
      exerciseId: 'exercise:1',
      isActive: false,
      editorHandle: editorHandle(setValue),
    }))

    act(() => {
      result.current.applySuggestion()
    })

    expect(setValue).not.toHaveBeenCalled()
    expect(useCodeSuggestionStore.getState().getAttemptEvidence('exercise:1')).toBeUndefined()
    expect(useCodeSuggestionStore.getState().suggestion).toBeNull()
  })

  it('returns an undo snapshot and records assistance when applying a changed suggestion', () => {
    const setValue = vi.fn()
    useCodeSuggestionStore.getState().setSuggestion({
      exerciseId: 'exercise:1',
      code: 'main() {\n    println("Hello")\n}',
      explanation: 'Use the expected output.',
      createdAt: 1,
    })
    const { result } = renderHook(() => useStagedCodeSuggestion({
      exerciseId: 'exercise:1',
      isActive: true,
      editorHandle: editorHandle(setValue, 'main() {\n    println("Hi")\n}'),
    }))

    const applied = result.current.applySuggestion() as AppliedCodeSuggestionSnapshot | null

    expect(setValue).toHaveBeenCalledWith('main() {\n    println("Hello")\n}')
    if (!applied)
      throw new Error('Expected an applied suggestion snapshot')
    expect(applied).toMatchObject({
      exerciseId: 'exercise:1',
      previousCode: 'main() {\n    println("Hi")\n}',
      appliedCode: 'main() {\n    println("Hello")\n}',
    })
    expect(applied.appliedAt).toEqual(expect.any(Number))
    expect(useCodeSuggestionStore.getState().getAttemptEvidence('exercise:1')).toEqual({
      assistance: [
        {
          kind: 'code_suggestion',
          appliedAt: applied.appliedAt,
        },
      ],
    })
    expect(useCodeSuggestionStore.getState().suggestion).toBeNull()
  })

  it('clears an unchanged suggestion without recording assistance', () => {
    const setValue = vi.fn()
    const unchanged = 'main() {\n    println("Hello")\n}'
    useCodeSuggestionStore.getState().setSuggestion({
      exerciseId: 'exercise:1',
      code: unchanged,
      explanation: 'Use the expected output.',
      createdAt: 1,
    })
    const { result } = renderHook(() => useStagedCodeSuggestion({
      exerciseId: 'exercise:1',
      isActive: true,
      editorHandle: editorHandle(setValue, unchanged),
    }))

    const applied = result.current.applySuggestion()

    expect(applied).toBeNull()
    expect(setValue).not.toHaveBeenCalled()
    expect(useCodeSuggestionStore.getState().getAttemptEvidence('exercise:1')).toBeUndefined()
    expect(useCodeSuggestionStore.getState().suggestion).toBeNull()
  })
})
