import { describe, expect, it } from 'vitest'
import { exerciseModelSlot, lessonEditorUriHint, lessonModelScope, playgroundModelUri } from './model-identity'

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

  it('derives stable teaching model identities from domain ids', () => {
    expect(lessonModelScope('lesson/1')).toBe('teach:lesson%2F1')
    expect(lessonEditorUriHint('lesson/1', 'b2')).toBe('teach:lesson%2F1:b2')
  })
})
