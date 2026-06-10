import { afterEach, describe, expect, it } from 'vitest'
import { useCodeSuggestionStore } from './code-suggestion-store'

describe('code suggestion store', () => {
  afterEach(() => {
    useCodeSuggestionStore.setState({
      suggestion: null,
      appliedAssistanceByExerciseId: {},
    })
  })

  it('records applied suggestions as attempt evidence separately from staged suggestions', () => {
    useCodeSuggestionStore.getState().setSuggestion({
      exerciseId: 'exercise:1',
      code: 'println("Hello")',
      explanation: 'Use the expected output.',
      createdAt: 1,
    })

    expect(useCodeSuggestionStore.getState().getAttemptEvidence('exercise:1')).toBeUndefined()

    useCodeSuggestionStore.getState().markSuggestionApplied('exercise:1', 2)
    useCodeSuggestionStore.getState().setSuggestion(null)

    expect(useCodeSuggestionStore.getState().getAttemptEvidence('exercise:1')).toEqual({
      assistance: [
        {
          kind: 'code_suggestion',
          appliedAt: 2,
        },
      ],
    })
  })

  it('removes one applied suggestion marker without clearing unrelated assistance', () => {
    useCodeSuggestionStore.getState().markSuggestionApplied('exercise:1', 2)
    useCodeSuggestionStore.getState().markSuggestionApplied('exercise:1', 3)
    useCodeSuggestionStore.getState().markSuggestionApplied('exercise:2', 4)

    useCodeSuggestionStore.getState().removeAppliedSuggestion('exercise:1', 2)

    expect(useCodeSuggestionStore.getState().getAttemptEvidence('exercise:1')).toEqual({
      assistance: [
        {
          kind: 'code_suggestion',
          appliedAt: 3,
        },
      ],
    })
    expect(useCodeSuggestionStore.getState().getAttemptEvidence('exercise:2')).toEqual({
      assistance: [
        {
          kind: 'code_suggestion',
          appliedAt: 4,
        },
      ],
    })

    useCodeSuggestionStore.getState().removeAppliedSuggestion('exercise:1', 3)

    expect(useCodeSuggestionStore.getState().getAttemptEvidence('exercise:1')).toBeUndefined()
  })

  it('clears suggestion and attempt evidence for a completed exercise', () => {
    useCodeSuggestionStore.getState().setSuggestion({
      exerciseId: 'exercise:1',
      code: 'println("Hello")',
      explanation: 'Use the expected output.',
      createdAt: 1,
    })
    useCodeSuggestionStore.getState().markSuggestionApplied('exercise:1', 2)

    useCodeSuggestionStore.getState().clearForExercise('exercise:1')

    expect(useCodeSuggestionStore.getState().suggestion).toBeNull()
    expect(useCodeSuggestionStore.getState().getAttemptEvidence('exercise:1')).toBeUndefined()
  })

  it('clears all staged suggestion state when the classroom is reset', () => {
    useCodeSuggestionStore.getState().setSuggestion({
      exerciseId: 'exercise:1',
      code: 'println("Hello")',
      explanation: 'Use the expected output.',
      createdAt: 1,
    })
    useCodeSuggestionStore.getState().markSuggestionApplied('exercise:1', 2)
    useCodeSuggestionStore.getState().markSuggestionApplied('exercise:2', 3)

    useCodeSuggestionStore.getState().clearAll()

    expect(useCodeSuggestionStore.getState().suggestion).toBeNull()
    expect(useCodeSuggestionStore.getState().appliedAssistanceByExerciseId).toEqual({})
  })
})
