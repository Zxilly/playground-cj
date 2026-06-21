/**
 * Browser-side accessor for the repo's curated, hand-written Cangjie "tour"
 * content, exposed to the Teacher agent as a high-quality, controllable grounding
 * source.
 *
 * The tour content lives on the filesystem (`tour/`) and is loaded server-side
 * (`@/tour/loader`), so the browser-side teacher reaches it through the
 * `/api/teach/tour` route. This module wraps that route in a typed accessor:
 *
 *  - {@link TourSource.outline} → the tour OUTLINE (chapters → steps with stable
 *    ids + titles), so the teacher can see what canonical material exists.
 *  - {@link TourSource.read} → a single step's curated prose + Cangjie code.
 *
 * Like {@link createCangjieMcpKnowledgeSource}, this degrades gracefully: when the
 * route is unavailable or returns an unexpected shape, the accessor resolves to an
 * empty outline / `null` step (logging a warning) rather than throwing, so a
 * grounding-source failure never breaks a teacher turn.
 */

/** Base path of the read-only tour API route (server-side tour loader bridge). */
export const TOUR_API_PATH = '/api/teach/tour'

/** One step in the tour outline: a stable id and its title. */
export interface TourOutlineStep {
  /** Stable `<chapterSlug>/<chapterStep>` id (e.g. `basics/1`). */
  id: string
  /** Title of the step's chapter (for grouping context). */
  chapter: string
  /** Human-readable title of the step. */
  title: string
}

/** One chapter in the tour outline: a stable id, its title, and its steps. */
export interface TourOutlineChapter {
  id: string
  title: string
  steps: TourOutlineStep[]
}

/** A single curated tour step's content in one language. */
export interface TourStep {
  /** Stable `<chapterSlug>/<chapterStep>` id (e.g. `basics/1`). */
  id: string
  /** UI language the prose/code is in (`zh` | `en`). */
  lang: string
  /** Title of the step's chapter. */
  chapter: string
  /** Human-readable title of the step. */
  title: string
  /** Curated prose (the section's markdown/MDX source). */
  markdown: string
  /** Curated Cangjie code sample for the step. */
  code: string
}

/**
 * Minimal shape of the `fetch` this source depends on. The real implementation is
 * the global `fetch`; tests inject a fake.
 */
export type FetchFn = (input: string, init?: { signal?: AbortSignal }) => Promise<{
  ok: boolean
  status: number
  json: () => Promise<unknown>
}>

export interface TourSourceDeps {
  /** Injected fetch; defaults to the global `fetch`. */
  fetch?: FetchFn
  /** Base path of the tour API route; defaults to {@link TOUR_API_PATH}. */
  basePath?: string
}

/**
 * Accessor over the curated tour content. The teacher's `list_tour` / `read_tour`
 * tools delegate here. Both methods never throw on a source failure — they
 * degrade to an empty outline / `null` step so grounding stays best-effort.
 */
export interface TourSource {
  /** Fetch the tour outline (chapters → steps) for `lang`. */
  outline: (lang: string, opts?: { signal?: AbortSignal }) => Promise<TourOutlineChapter[]>
  /** Fetch a single curated step by id for `lang`, or null when unavailable. */
  read: (id: string, lang: string, opts?: { signal?: AbortSignal }) => Promise<TourStep | null>
}

function isOutlineChapter(value: unknown): value is TourOutlineChapter {
  if (typeof value !== 'object' || value === null)
    return false
  const c = value as { id?: unknown, title?: unknown, steps?: unknown }
  return typeof c.id === 'string' && typeof c.title === 'string' && Array.isArray(c.steps)
}

function isStep(value: unknown): value is TourStep {
  if (typeof value !== 'object' || value === null)
    return false
  const s = value as { id?: unknown, markdown?: unknown, code?: unknown }
  return typeof s.id === 'string' && typeof s.markdown === 'string' && typeof s.code === 'string'
}

/**
 * Build a {@link TourSource} backed by the `/api/teach/tour` route.
 *
 * @param deps Optional injected `fetch` and base path (tests inject fakes).
 */
export function createTourSource(deps: TourSourceDeps = {}): TourSource {
  const doFetch = deps.fetch ?? ((input, init) => fetch(input, init))
  const basePath = deps.basePath ?? TOUR_API_PATH

  return {
    outline: async (lang, opts) => {
      try {
        const res = await doFetch(`${basePath}?lang=${encodeURIComponent(lang)}`, { signal: opts?.signal })
        if (!res.ok)
          return []
        const body = await res.json()
        const outline = (body as { outline?: unknown })?.outline
        if (!Array.isArray(outline))
          return []
        return outline.filter(isOutlineChapter)
      }
      catch (err) {
        console.warn('[teach] tour source outline unavailable', err)
        return []
      }
    },
    read: async (id, lang, opts) => {
      try {
        const res = await doFetch(
          `${basePath}?step=${encodeURIComponent(id)}&lang=${encodeURIComponent(lang)}`,
          { signal: opts?.signal },
        )
        if (!res.ok)
          return null
        const body = await res.json()
        const step = (body as { step?: unknown })?.step
        return isStep(step) ? step : null
      }
      catch (err) {
        console.warn('[teach] tour source read unavailable', err)
        return null
      }
    },
  }
}
