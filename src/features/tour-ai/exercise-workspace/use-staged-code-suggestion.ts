'use client'

import { useCallback, useEffect } from 'react'
import { useCodeSuggestionStore } from '@/features/tour-ai/state/code-suggestion-store'
import type { MonacoEditorHandle } from '@/modules/cangjie-editor/components/EditorWrapper'

export interface AppliedCodeSuggestionSnapshot {
  exerciseId: string
  previousCode: string
  appliedCode: string
  appliedAt: number
}

export function useStagedCodeSuggestion({
  exerciseId,
  isActive,
  editorHandle,
}: {
  exerciseId: string
  isActive: boolean
  editorHandle?: MonacoEditorHandle
}) {
  const suggestion = useCodeSuggestionStore(state =>
    state.suggestion?.exerciseId === exerciseId ? state.suggestion : null,
  )
  const clearSuggestion = useCodeSuggestionStore(state => state.setSuggestion)

  const applySuggestion = useCallback((): AppliedCodeSuggestionSnapshot | null => {
    const current = useCodeSuggestionStore.getState().suggestion
    if (!current || current.exerciseId !== exerciseId)
      return null
    if (!isActive) {
      clearSuggestion(null)
      return null
    }
    const model = editorHandle?.getEditor()?.getModel()
    if (!model)
      return null
    const previousCode = model.getValue()
    if (previousCode === current.code) {
      clearSuggestion(null)
      return null
    }
    const appliedAt = Date.now()
    model.setValue(current.code)
    useCodeSuggestionStore.getState().markSuggestionApplied(exerciseId, appliedAt)
    clearSuggestion(null)
    return {
      exerciseId,
      previousCode,
      appliedCode: current.code,
      appliedAt,
    }
  }, [isActive, exerciseId, editorHandle, clearSuggestion])

  useEffect(() => {
    if (!isActive)
      return
    const current = useCodeSuggestionStore.getState().suggestion
    if (current && current.exerciseId !== exerciseId)
      useCodeSuggestionStore.getState().setSuggestion(null)
  }, [isActive, exerciseId])

  return {
    suggestion,
    clearSuggestion,
    applySuggestion,
  }
}
