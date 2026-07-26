import type { ClassroomSnapshot } from '@/lib/teach/classroom/state'
import type { ContentPackCatalog } from '@/lib/teach/classroom/content-catalog'

/**
 * Resolve the single Concept shared by Review View and its scoped Teacher Chat.
 * An invalid persisted selection cannot make the visible review surface and
 * the model capability boundary point at different Concepts.
 */
export function resolveReviewConceptId(
  selectedId: string | null,
  snapshot: ClassroomSnapshot,
  catalog: ContentPackCatalog,
): string | undefined {
  if (selectedId && catalog.get(selectedId))
    return selectedId

  const activeTrack = snapshot.tracks.find(
    track => track.id === snapshot.activeTrackId,
  )
  const trackConceptId = activeTrack?.conceptIds.find(
    conceptId => catalog.get(conceptId) !== undefined,
  )
  return trackConceptId ?? catalog.list()[0]?.conceptId
}
