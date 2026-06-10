'use client'

import { useEffect } from 'react'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import type { ExerciseInstance } from '@/lib/ai/classroom/types'
import type { MonacoEditorHandle } from '@/modules/cangjie-editor/components/EditorWrapper'
import { useCodeSuggestionStore } from '@/features/tour-ai/state/code-suggestion-store'
import { useExerciseDraftStore } from '@/features/tour-ai/state/exercise-draft-store'

export function useActiveExerciseEditorRegistration({
  isActive,
  editorHandle,
  bridge,
}: {
  isActive: boolean
  editorHandle?: MonacoEditorHandle
  bridge: AIClassroomBridgeValue
}) {
  useEffect(() => {
    if (!isActive || !editorHandle)
      return
    const editor = editorHandle.getEditor()
    if (!editor)
      return
    bridge.editor.setEditor(editor)
    return () => {
      if (bridge.editor.getEditor() === editor)
        bridge.editor.setEditor(undefined)
    }
  }, [isActive, editorHandle, bridge.editor])
}

export function useExerciseWorkspaceCleanup(exercise: Pick<ExerciseInstance, 'id' | 'status'>) {
  useEffect(() => {
    if (exercise.status === 'success' || exercise.status === 'skip')
      useExerciseDraftStore.getState().clearDraft(exercise.id)
    if (exercise.status !== 'active')
      useCodeSuggestionStore.getState().clearForExercise(exercise.id)
  }, [exercise.id, exercise.status])
}

export function useExerciseDraftPersistence({
  editorHandle,
  exercise,
}: {
  editorHandle?: MonacoEditorHandle
  exercise: Pick<ExerciseInstance, 'id' | 'starterCode'>
}) {
  useEffect(() => {
    if (!editorHandle)
      return
    const editor = editorHandle.getEditor()
    const model = editor?.getModel()
    if (!editor || !model)
      return

    const persisted = useExerciseDraftStore.getState().getDraft(exercise.id)
    const current = model.getValue()
    if (persisted && persisted.code !== current && current === exercise.starterCode)
      model.setValue(persisted.code)

    let timer: ReturnType<typeof setTimeout> | undefined
    const flush = () => {
      timer = undefined
      useExerciseDraftStore.getState().setDraft(exercise.id, model.getValue())
    }
    const subscription = model.onDidChangeContent(() => {
      if (timer)
        clearTimeout(timer)
      timer = setTimeout(flush, 300)
    })
    return () => {
      if (timer) {
        clearTimeout(timer)
        flush()
      }
      subscription.dispose()
    }
  }, [editorHandle, exercise.id, exercise.starterCode])
}
