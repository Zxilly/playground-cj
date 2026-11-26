// @vitest-environment node

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findChapterRefSections, getAllConcepts } from '@/lib/ai/concept-graph/loader'
import { ALL_LANGUAGES } from '@/stores/knownLanguages'
import { loadStaticTourContentSections } from '@/lib/teach/classroom/static-tour-content-source'

const TOUR_ROOT = join(process.cwd(), 'tour')
const TOP_LEVEL_DIR_RE = /^\d+-[a-z0-9-]+$/
const SECTION_DIR_RE = /^\d+$/
const COMPARE_WITH_LANG_RE = /<CompareWith\b[^>]+?\blang\s*=\s*["']([^"']+)["']/g
const HARDCODED_LINE_REF_RE = /第\s*\d+\s*行|\bline\s+\d+\b/i

function listChildDirs(dir: string, pattern: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && pattern.test(entry.name))
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

function walkMdxFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkMdxFiles(fullPath))
    }
    else if (entry.name.endsWith('.mdx') || entry.name.endsWith('.md')) {
      results.push(fullPath)
    }
  }
  return results
}

describe('tour content guardrails', () => {
  it('enforces unique numeric prefixes across chapters, subchapters, and sections', () => {
    const collisions: string[] = []

    const checkUnique = (dir: string, names: string[]) => {
      const seen = new Map<number, string>()
      for (const name of names) {
        const prefix = Number.parseInt(name, 10)
        const prev = seen.get(prefix)
        if (prev)
          collisions.push(`${relative(TOUR_ROOT, dir) || '.'}: "${prev}" vs "${name}" (prefix ${prefix})`)
        else
          seen.set(prefix, name)
      }
    }

    const chapters = listChildDirs(TOUR_ROOT, TOP_LEVEL_DIR_RE)
    checkUnique(TOUR_ROOT, chapters)

    for (const chapter of chapters) {
      const chapterDir = join(TOUR_ROOT, chapter)
      const subChapters = listChildDirs(chapterDir, TOP_LEVEL_DIR_RE)
      checkUnique(chapterDir, subChapters)

      for (const subChapter of subChapters) {
        const subDir = join(chapterDir, subChapter)
        const sections = listChildDirs(subDir, SECTION_DIR_RE)
        checkUnique(subDir, sections)
      }
    }

    expect(collisions).toEqual([])
  })

  it('restricts all <CompareWith lang="..."> tags to registered known languages', () => {
    const allowed = new Set<string>(ALL_LANGUAGES)
    const violations: string[] = []

    for (const filePath of walkMdxFiles(TOUR_ROOT)) {
      const content = readFileSync(filePath, 'utf8')
      for (const match of content.matchAll(COMPARE_WITH_LANG_RE)) {
        const lang = match[1]
        if (!allowed.has(lang))
          violations.push(`${relative(TOUR_ROOT, filePath)}: unsupported lang="${lang}"`)
      }
    }

    expect(violations).toEqual([])
  })

  it('resolves every concept-graph chapterRef to existing tour sections', () => {
    const sections = loadStaticTourContentSections()
    const missing: string[] = []

    for (const concept of getAllConcepts()) {
      for (const ref of concept.chapterRefs) {
        const matched = findChapterRefSections(ref, sections)
        if (matched.length === 0)
          missing.push(`${concept.conceptId} -> ${ref}`)
      }
    }

    expect(missing).toEqual([])
  })

  it('avoids duplicate subchapter names matching their parent chapter when a chapter has multiple subchapters', () => {
    const duplicates: string[] = []

    for (const chapter of listChildDirs(TOUR_ROOT, TOP_LEVEL_DIR_RE)) {
      const chapterDir = join(TOUR_ROOT, chapter)
      const subChapters = listChildDirs(chapterDir, TOP_LEVEL_DIR_RE)
      if (subChapters.length <= 1)
        continue

      const chapterName = JSON.parse(readFileSync(join(chapterDir, 'name.json'), 'utf8')) as {
        zh: string
        en: string
      }

      for (const subChapter of subChapters) {
        const subName = JSON.parse(readFileSync(join(chapterDir, subChapter, 'name.json'), 'utf8')) as {
          zh: string
          en: string
        }
        if (subName.zh === chapterName.zh || subName.en === chapterName.en)
          duplicates.push(`${chapter}/${subChapter}: ${JSON.stringify(subName)} duplicates parent ${JSON.stringify(chapterName)}`)
      }
    }

    expect(duplicates).toEqual([])
  })

  it('avoids brittle hardcoded line-number references in tour MDX files', () => {
    const violations: string[] = []

    for (const filePath of walkMdxFiles(TOUR_ROOT)) {
      const lines = readFileSync(filePath, 'utf8').split(/\r?\n/)
      lines.forEach((line, index) => {
        if (HARDCODED_LINE_REF_RE.test(line))
          violations.push(`${relative(TOUR_ROOT, filePath)}:${index + 1}: ${line.trim()}`)
      })
    }

    expect(violations).toEqual([])
  })
})
