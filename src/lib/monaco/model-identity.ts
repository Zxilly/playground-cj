const PLAYGROUND_ROOT = 'file:///playground'
const EXERCISE_SLOT_PREFIX = 'exercise-'

export function exerciseModelSlot(slot: string): string {
  return `${EXERCISE_SLOT_PREFIX}${encodeURIComponent(slot)}`
}

export function playgroundModelUri(slot: string): string {
  return `${PLAYGROUND_ROOT}/${slot}/main.cj`
}
