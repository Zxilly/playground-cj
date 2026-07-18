const PLAYGROUND_ROOT = 'file:///playground'
const EXERCISE_SLOT_PREFIX = 'exercise-'

function stableSlotHash(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1)
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619)
  return (hash >>> 0).toString(36)
}

export function exerciseModelSlot(slot: string): string {
  const slug = slot
    .replace(/[^\w-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'editor'
  return `${EXERCISE_SLOT_PREFIX}${slug}-${stableSlotHash(slot)}`
}

export function playgroundModelUri(slot: string): string {
  return slot === 'src'
    ? `${PLAYGROUND_ROOT}/src/main.cj`
    : `${PLAYGROUND_ROOT}/src/${slot}.cj`
}

export function lessonModelScope(lessonId: string): string {
  return `teach:${encodeURIComponent(lessonId)}`
}

export function lessonEditorUriHint(lessonId: string, blockId: string): string {
  return `${lessonModelScope(lessonId)}:${encodeURIComponent(blockId)}`
}
