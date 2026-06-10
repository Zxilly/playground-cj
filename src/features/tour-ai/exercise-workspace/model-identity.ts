const PLAYGROUND_ROOT = 'file:///playground'
const EXERCISE_SLOT_PREFIX = 'exercise-'

export function exerciseModelSlot(exerciseId: string): string {
  return `${EXERCISE_SLOT_PREFIX}${encodeURIComponent(exerciseId)}`
}

export function playgroundModelUri(slot: string): string {
  return `${PLAYGROUND_ROOT}/${slot}/main.cj`
}

export function exerciseModelUri(exerciseId: string): string {
  return playgroundModelUri(exerciseModelSlot(exerciseId))
}

export function isExerciseModelUri(uri: string): boolean {
  return uri.startsWith(`${PLAYGROUND_ROOT}/${EXERCISE_SLOT_PREFIX}`)
}
