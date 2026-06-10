import * as monaco from '@codingame/monaco-vscode-editor-api'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import { useExerciseDraftStore } from '@/features/tour-ai/state/exercise-draft-store'
import { exerciseModelUri, isExerciseModelUri } from './model-identity'

export type LearnerCodeSourceKind
  = | 'focused'
    | 'bridge'
    | 'active_exercise_model'
    | 'detached_model'
    | 'draft'
    | 'starter'

export interface LearnerCodeSource {
  code: string
  lineCount: number
  language: string
  source: LearnerCodeSourceKind
  exerciseId?: string
  stale?: true
}

function codeSource(
  code: string,
  source: LearnerCodeSourceKind,
  options: {
    language?: string
    lineCount?: number
    exerciseId?: string
    stale?: true
  } = {},
): LearnerCodeSource {
  return {
    code,
    lineCount: options.lineCount ?? code.split('\n').length,
    language: options.language ?? 'cangjie',
    source,
    ...(options.exerciseId ? { exerciseId: options.exerciseId } : {}),
    ...(options.stale ? { stale: true } : {}),
  }
}

export function resolveLearnerCodeSource(bridge: AIClassroomBridgeValue): LearnerCodeSource | null {
  const editors = monaco.editor.getEditors?.() ?? []
  const focused = editors.find(editor => editor.hasTextFocus?.())
  const focusedModel = focused?.getModel()
  if (focusedModel) {
    return codeSource(focusedModel.getValue(), 'focused', {
      lineCount: focusedModel.getLineCount(),
      language: focusedModel.getLanguageId(),
    })
  }

  const bridgeModel = bridge.editor.getEditor()?.getModel?.()
  if (bridgeModel) {
    return codeSource(bridgeModel.getValue(), 'bridge', {
      lineCount: bridgeModel.getLineCount(),
      language: bridgeModel.getLanguageId(),
    })
  }

  const currentExercise = bridge.classroom?.getSession().currentExercise
  if (currentExercise && monaco.Uri?.parse && monaco.editor.getModel) {
    const model = monaco.editor.getModel(monaco.Uri.parse(exerciseModelUri(currentExercise.id)))
    if (model) {
      return codeSource(model.getValue(), 'active_exercise_model', {
        lineCount: model.getLineCount(),
        language: model.getLanguageId(),
        exerciseId: currentExercise.id,
      })
    }
  }

  const exerciseModels = (monaco.editor.getModels?.() ?? [])
    .filter(model => isExerciseModelUri(model.uri.toString()))
  const detached = (currentExercise
    ? exerciseModels.find(model => model.uri.toString() === exerciseModelUri(currentExercise.id))
    : undefined) ?? exerciseModels[0]
  if (detached) {
    return codeSource(detached.getValue(), 'detached_model', {
      lineCount: detached.getLineCount(),
      language: detached.getLanguageId(),
    })
  }

  if (currentExercise) {
    const draft = useExerciseDraftStore.getState().getDraft(currentExercise.id)
    if (draft?.code) {
      return codeSource(draft.code, 'draft', {
        exerciseId: currentExercise.id,
        stale: true,
      })
    }

    return codeSource(currentExercise.starterCode, 'starter', {
      exerciseId: currentExercise.id,
      stale: true,
    })
  }

  return null
}
