/**
 * A single grounding result returned by a {@link KnowledgeSource}.
 *
 * Hits are the unit the teacher agent cites. A hit always carries the id of the
 * source it came from ({@link KnowledgeHit.sourceId}) plus a source-local
 * reference ({@link KnowledgeHit.ref}) so a citation can be resolved back to the
 * exact entry it grounds. `url` is optional because not every source exposes a
 * stable address.
 */
export interface KnowledgeHit {
  /** Identifier of the {@link KnowledgeSource} that produced this hit. */
  sourceId: string
  /** Source-local reference to the matched entry (e.g. a doc path). */
  ref: string
  /** Human-readable title of the matched entry. */
  title: string
  /** Excerpt of the matched content, suitable for grounding a citation. */
  snippet: string
  /** Optional absolute URL of the entry, when the source exposes one. */
  url?: string
}

/**
 * A pluggable source of trusted knowledge the teacher agent can search to
 * ground factual claims before teaching them.
 *
 * The teacher is forbidden from trusting parametric guesses about Cangjie; it
 * must {@link KnowledgeSource.search} first and cite the resulting hits. The
 * interface is intentionally minimal so additional sources (e.g. future bundled
 * docs) can register behind it without the toolkit caring which one answered.
 */
export interface KnowledgeSource {
  /** Stable identifier embedded into every {@link KnowledgeHit.sourceId}. */
  readonly id: string
  /**
   * Search the source for entries relevant to `query`.
   *
   * Implementations must resolve to an empty array (never throw) when the
   * backing source is unavailable, so grounding failures degrade gracefully.
   */
  search: (query: string, opts?: { limit?: number }) => Promise<KnowledgeHit[]>
}
