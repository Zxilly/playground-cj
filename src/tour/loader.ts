import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { FlatSection, TourChapter, TourChapterSlim, TourSection, TourSubChapter } from './types'

const TOUR_DIR = join(process.cwd(), 'tour')

function readNameJson(dir: string): Record<string, string> {
  const filePath = join(dir, 'name.json')
  if (!existsSync(filePath))
    return { zh: '', en: '' }
  return JSON.parse(readFileSync(filePath, 'utf-8'))
}

function readFileOrEmpty(filePath: string): string {
  if (!existsSync(filePath))
    return ''
  return readFileSync(filePath, 'utf-8')
}

function loadSection(sectionDir: string, sectionId: string): TourSection {
  const name = readNameJson(sectionDir)
  const zhMd = readFileOrEmpty(join(sectionDir, 'index.zh.md'))
  const enMd = readFileOrEmpty(join(sectionDir, 'index.en.md'))
  const code = readFileOrEmpty(join(sectionDir, 'index.cj'))

  return {
    id: sectionId,
    name,
    markdown: { zh: zhMd, en: enMd },
    code,
  }
}

function loadSubChapter(subDir: string, subId: string): TourSubChapter {
  const name = readNameJson(subDir)
  const entries = readdirSync(subDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && /^\d+/.test(e.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))

  const sections = entries.map(e => loadSection(join(subDir, e.name), e.name))

  return { id: subId, name, sections }
}

function loadChapter(chapterDir: string, chapterId: string): TourChapter {
  const name = readNameJson(chapterDir)
  const entries = readdirSync(chapterDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name.match(/^\d+-/))
    .sort((a, b) => a.name.localeCompare(b.name))

  const subChapters = entries.map(e => loadSubChapter(join(chapterDir, e.name), e.name))

  return { id: chapterId, name, subChapters }
}

let cachedTourData: TourChapter[] | null = null
let cachedFlatSections: FlatSection[] | null = null

export function loadTourData(): TourChapter[] {
  if (cachedTourData)
    return cachedTourData

  if (!existsSync(TOUR_DIR))
    return []

  const entries = readdirSync(TOUR_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name.match(/^\d+-/))
    .sort((a, b) => a.name.localeCompare(b.name))

  cachedTourData = entries.map(e => loadChapter(join(TOUR_DIR, e.name), e.name))
  return cachedTourData
}

export function flattenSections(data: TourChapter[]): FlatSection[] {
  if (cachedFlatSections)
    return cachedFlatSections

  const flat: FlatSection[] = []

  for (const chapter of data) {
    for (const sub of chapter.subChapters) {
      for (const section of sub.sections) {
        flat.push({
          chapterId: chapter.id,
          chapterName: chapter.name,
          subChapterId: sub.id,
          subChapterName: sub.name,
          sectionId: section.id,
          sectionName: section.name,
          markdown: section.markdown,
          code: section.code,
        })
      }
    }
  }

  cachedFlatSections = flat
  return flat
}

export function getSlimTourData(data: TourChapter[]): TourChapterSlim[] {
  return data.map(chapter => ({
    id: chapter.id,
    name: chapter.name,
    subChapters: chapter.subChapters.map(sub => ({
      id: sub.id,
      name: sub.name,
      sections: sub.sections.map(section => ({
        id: section.id,
        name: section.name,
      })),
    })),
  }))
}
