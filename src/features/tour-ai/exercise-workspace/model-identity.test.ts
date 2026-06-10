import { describe, expect, it } from 'vitest'
import { exerciseModelSlot, exerciseModelUri, isExerciseModelUri, playgroundModelUri } from './model-identity'

describe('exercise model identity', () => {
  it('builds the same exercise model URI shape used by Monaco editor config', () => {
    expect(exerciseModelSlot('exercise:1')).toBe('exercise-exercise%3A1')
    expect(exerciseModelUri('exercise:1')).toBe('file:///playground/exercise-exercise%3A1/main.cj')
  })

  it('builds playground URIs for non-exercise slots too', () => {
    expect(playgroundModelUri('src')).toBe('file:///playground/src/main.cj')
  })

  it('recognizes exercise model URIs', () => {
    expect(isExerciseModelUri('file:///playground/exercise-exercise%3A1/main.cj')).toBe(true)
    expect(isExerciseModelUri('file:///playground/src/main.cj')).toBe(false)
  })
})
