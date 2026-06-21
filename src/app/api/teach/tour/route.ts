import { NextResponse } from 'next/server'
import { flattenSections, loadTourData } from '@/tour/loader'

/**
 * Read-only endpoint exposing the repo's curated, hand-written Cangjie "tour"
 * content to the browser-side Teacher agent as a high-quality grounding source.
 *
 * The tour loader (`@/tour/loader`) reads the filesystem `tour/` directory, so it
 * must run server-side — the Teacher agent runs in the browser and cannot touch
 * the filesystem. This route is the bridge: it reuses the same loader the public
 * `/tour` route renders from, then projects it into two compact, lang-aware
 * shapes the teacher tools (`list_tour` / `read_tour`) consume.
 *
 * Node runtime: the loader uses `node:fs` to read the tour content off disk.
 *
 * Query params:
 *  - (none)                  → the tour OUTLINE: chapters → steps with a stable
 *    `id`, title, and lang. Compact (no prose/code) so the teacher can scan what
 *    canonical material exists.
 *  - `?step=<id>&lang=<lang>` → that single step's curated prose (markdown) + the
 *    curated Cangjie code, in the requested language.
 *
 * A step `id` is the stable `<chapterSlug>/<chapterStep>` pair the public tour
 * route already keys on (e.g. `basics/1`), so it survives content reordering as
 * long as a step keeps its place in its chapter.
 */
export const runtime = 'nodejs'

/** One step in the outline: id + per-lang title. */
interface TourOutlineStep {
  id: string
  chapter: string
  title: string
}

/** One chapter in the outline: id + per-lang title + its steps. */
interface TourOutlineChapter {
  id: string
  title: string
  steps: TourOutlineStep[]
}

/** A single curated step's content in one language. */
interface TourStepContent {
  id: string
  lang: string
  chapter: string
  title: string
  /** Curated prose (the section's markdown/MDX source). */
  markdown: string
  /** Curated Cangjie code sample for the step. */
  code: string
}

function normalizeLang(lang: string | null): 'zh' | 'en' {
  return lang === 'en' ? 'en' : 'zh'
}

/** Stable id for a step: `<chapterSlug>/<chapterStep>` (e.g. `basics/1`). */
function stepId(chapterSlug: string, chapterStep: string): string {
  return `${chapterSlug}/${chapterStep}`
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const step = url.searchParams.get('step')
  const lang = normalizeLang(url.searchParams.get('lang'))

  const tourData = await loadTourData()
  const flat = flattenSections(tourData)

  if (step) {
    const section = flat.find(s => stepId(s.chapterSlug, s.chapterStep) === step)
    if (!section)
      return NextResponse.json({ error: `No tour step with id ${step}.` }, { status: 404 })

    const content: TourStepContent = {
      id: step,
      lang,
      chapter: section.chapterName[lang] ?? section.chapterName.zh ?? '',
      title: section.sectionName[lang] ?? section.sectionName.zh ?? '',
      markdown: section.markdown[lang] ?? section.markdown.zh ?? '',
      code: section.code[lang] ?? section.code.zh ?? '',
    }
    return NextResponse.json({ step: content })
  }

  const byChapter = new Map<string, TourOutlineChapter>()
  for (const section of flat) {
    let chapter = byChapter.get(section.chapterSlug)
    if (!chapter) {
      chapter = {
        id: section.chapterSlug,
        title: section.chapterName[lang] ?? section.chapterName.zh ?? '',
        steps: [],
      }
      byChapter.set(section.chapterSlug, chapter)
    }
    chapter.steps.push({
      id: stepId(section.chapterSlug, section.chapterStep),
      chapter: chapter.title,
      title: section.sectionName[lang] ?? section.sectionName.zh ?? '',
    })
  }

  const outline: TourOutlineChapter[] = [...byChapter.values()]
  return NextResponse.json({ outline })
}
