import type { ContentPackCatalog } from '@/lib/teach/classroom/content-catalog'

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/^\/+|\/+$/gu, '')
}

/**
 * Resolves a `?topic=` query parameter (e.g. a concept id like `cj.var.immutable`,
 * a short slug like `main` or `println`, a Tour step ref like `01-welcome/01-intro/01`,
 * or a localized concept title) to a matching concept in the active catalog.
 */
export function resolveTopicToConceptId(
  topic: string | null | undefined,
  catalog: ContentPackCatalog,
): string | null {
  if (!topic)
    return null
  const needle = normalizeToken(topic)
  if (!needle)
    return null

  const summaries = catalog.list()

  // 1. Exact concept ID match
  for (const summary of summaries) {
    if (normalizeToken(summary.conceptId) === needle)
      return summary.conceptId
  }

  // 2. Tour source reference match (exact or prefix/suffix)
  for (const summary of summaries) {
    const pack = catalog.get(summary.conceptId)
    if (!pack)
      continue
    for (const block of pack.blocks) {
      for (const ref of block.sourceReferences) {
        const normalizedRef = normalizeToken(ref.ref)
        if (
          normalizedRef === needle
          || normalizedRef.startsWith(`${needle}/`)
          || needle.startsWith(`${normalizedRef}/`)
          || normalizedRef.includes(needle)
        ) {
          return summary.conceptId
        }
      }
    }
  }

  // 3. Concept ID segment match (e.g. `main` -> `cj.program.main`, `immutable` -> `cj.var.immutable`)
  for (const summary of summaries) {
    const segments = normalizeToken(summary.conceptId).split('.')
    if (segments.includes(needle))
      return summary.conceptId
  }

  // 4. Title or summary substring match
  for (const summary of summaries) {
    const pack = catalog.get(summary.conceptId)
    if (normalizeToken(summary.title).includes(needle))
      return summary.conceptId
    if (pack && normalizeToken(pack.concept.summary).includes(needle))
      return summary.conceptId
  }

  return null
}

export function readTopicFromLocation(location?: { search: string }): string | null {
  const search = location?.search ?? (typeof window !== 'undefined' ? window.location.search : '')
  if (!search)
    return null
  const raw = new URLSearchParams(search).get('topic')?.trim()
  return raw || null
}
