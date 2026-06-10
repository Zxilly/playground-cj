import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import type { ExerciseInstance } from '@/lib/ai/classroom/types'
import { useExerciseDraftStore } from '@/features/tour-ai/state/exercise-draft-store'
import { exerciseModelUri } from './model-identity'
import { resolveLearnerCodeSource } from './learner-code-source'

interface FakeModel {
  value: string
  uri: { toString: () => string }
  getValue: () => string
  getLineCount: () => number
  getLanguageId: () => string
}

const monacoState = vi.hoisted(() => ({
  editors: [] as Array<{ hasTextFocus?: () => boolean, getModel: () => unknown }>,
  models: [] as unknown[],
  modelsByUri: new Map<string, unknown>(),
}))

vi.mock('@codingame/monaco-vscode-editor-api', () => ({
  editor: {
    getEditors: () => monacoState.editors,
    getModel: (uri: { toString: () => string }) => monacoState.modelsByUri.get(uri.toString()) ?? null,
    getModels: () => monacoState.models,
  },
  Uri: {
    parse: (uri: string) => ({ toString: () => uri }),
  },
}))

const exercise: ExerciseInstance = {
  id: 'exercise:1',
  templateId: 'template',
  templateVersion: '2026-05-28',
  skillId: 'skill',
  conceptIds: ['concept'],
  prompt: 'Print 1.',
  starterCode: 'main() {\n    // start\n}',
  expectedOutput: '1',
  matchMode: 'exact',
  status: 'active',
  intent: 'mainline',
  personalizationInputs: { summary: 'test' },
  createdAt: 1,
}

function fakeModel(uri: string, value: string): FakeModel {
  return {
    value,
    uri: { toString: () => uri },
    getValue: () => value,
    getLineCount: () => value.split('\n').length,
    getLanguageId: () => 'cangjie',
  }
}

function bridge(options: {
  editorModel?: FakeModel | null
  currentExercise?: ExerciseInstance | null
} = {}): AIClassroomBridgeValue {
  return {
    editor: {
      getEditor: () => options.editorModel === undefined
        ? null
        : { getModel: () => options.editorModel },
    },
    classroom: {
      getSession: () => ({ currentExercise: options.currentExercise ?? null }),
    },
  } as unknown as AIClassroomBridgeValue
}

describe('resolveLearnerCodeSource', () => {
  beforeEach(() => {
    monacoState.editors = []
    monacoState.models = []
    monacoState.modelsByUri.clear()
    useExerciseDraftStore.setState({ drafts: {} })
  })

  it('prefers the focused editor over bridge and persisted exercise state', () => {
    const focused = fakeModel('inmemory://focused.cj', 'focused()')
    const bridgeModel = fakeModel('inmemory://bridge.cj', 'bridge()')
    monacoState.editors = [{ hasTextFocus: () => true, getModel: () => focused }]

    expect(resolveLearnerCodeSource(bridge({ editorModel: bridgeModel, currentExercise: exercise }))).toMatchObject({
      code: 'focused()',
      source: 'focused',
    })
  })

  it('uses the active exercise model URI before stale fallbacks', () => {
    const model = fakeModel(exerciseModelUri(exercise.id), 'main() {\n    println(1)\n}')
    monacoState.modelsByUri.set(exerciseModelUri(exercise.id), model)
    useExerciseDraftStore.getState().setDraft(exercise.id, 'draft')

    expect(resolveLearnerCodeSource(bridge({ currentExercise: exercise }))).toMatchObject({
      code: 'main() {\n    println(1)\n}',
      source: 'active_exercise_model',
      exerciseId: exercise.id,
    })
  })

  it('falls back to draft, then starter code for the current exercise', () => {
    useExerciseDraftStore.getState().setDraft(exercise.id, 'draft')
    expect(resolveLearnerCodeSource(bridge({ currentExercise: exercise }))).toMatchObject({
      code: 'draft',
      source: 'draft',
      stale: true,
    })

    useExerciseDraftStore.getState().clearDraft(exercise.id)
    expect(resolveLearnerCodeSource(bridge({ currentExercise: exercise }))).toMatchObject({
      code: exercise.starterCode,
      source: 'starter',
      stale: true,
    })
  })
})
