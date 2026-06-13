import { describe, expect, it } from 'vitest'
import { exerciseModelSlot, playgroundModelUri } from './model-identity'

describe('monaco model identity', () => {
  it('encodes the slot hint into a stable exercise slot', () => {
    expect(exerciseModelSlot('exercise:1')).toBe('exercise-exercise%3A1')
  })

  it('builds playground URIs for any slot', () => {
    expect(playgroundModelUri('src')).toBe('file:///playground/src/main.cj')
    expect(playgroundModelUri(exerciseModelSlot('exercise:1'))).toBe(
      'file:///playground/exercise-exercise%3A1/main.cj',
    )
  })
})
