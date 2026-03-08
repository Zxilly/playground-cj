import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { serialize } from 'next-mdx-remote/serialize'
import remarkGfm from 'remark-gfm'
import type { FlatSection, TourChapter, TourChapterSlim, TourSection, TourSubChapter } from './types'

const TOUR_DIR = join(process.cwd(), 'tour')
const TOP_LEVEL_DIR_RE = /^\d+-[a-z0-9-]+$/
const SECTION_DIR_RE = /^\d+$/

function stripOrderPrefix(id: string): string {
  return id.replace(/^\d+-/, '')
}

function compareIds(a: string, b: string): number {
  const aNum = Number.parseInt(a, 10)
  const bNum = Number.parseInt(b, 10)

  if (!Number.isNaN(aNum) && !Number.isNaN(bNum) && aNum !== bNum)
    return aNum - bNum

  return a.localeCompare(b, undefined, { numeric: true })
}

function readRequiredFile(filePath: string): string {
  if (!existsSync(filePath))
    throw new Error(`Missing required file: ${filePath}`)

  return readFileSync(filePath, 'utf-8')
}

function readNameJson(dir: string): Record<string, string> {
  const filePath = join(dir, 'name.json')
  const raw = readRequiredFile(filePath)
  const parsed = JSON.parse(raw) as Record<string, unknown>
  const zh = typeof parsed.zh === 'string' ? parsed.zh.trim() : ''
  const en = typeof parsed.en === 'string' ? parsed.en.trim() : ''

  if (!zh || !en)
    throw new Error(`Invalid name.json in ${dir}`)

  return { zh, en }
}

function readMarkdownTitle(markdown: string, filePath: string): string {
  const [firstLine = ''] = markdown.replace(/^\uFEFF/, '').split(/\r?\n/, 1)
  if (!firstLine.startsWith('# '))
    throw new Error(`Missing top-level markdown heading in ${filePath}`)

  const title = firstLine.slice(2).trim()
  if (!title)
    throw new Error(`Missing top-level markdown heading in ${filePath}`)

  return title
}

async function loadSection(sectionDir: string, sectionId: string): Promise<TourSection> {
  // Try .mdx first, then .md
  const zhMdxPath = join(sectionDir, 'index.zh.mdx')
  const zhMdPath = join(sectionDir, 'index.zh.md')
  const enMdxPath = join(sectionDir, 'index.en.mdx')
  const enMdPath = join(sectionDir, 'index.en.md')

  const zhPath = existsSync(zhMdxPath) ? zhMdxPath : zhMdPath
  const enPath = existsSync(enMdxPath) ? enMdxPath : enMdPath

  const zhMd = readRequiredFile(zhPath)
  const enMd = readRequiredFile(enPath)

  // Load locale-specific code files, falling back to index.cj
  const defaultCjPath = join(sectionDir, 'index.cj')
  const code: Record<string, string> = {}
  for (const lang of ['en', 'zh']) {
    const localePath = join(sectionDir, `index.${lang}.cj`)
    if (existsSync(localePath)) {
      code[lang] = readFileSync(localePath, 'utf-8')
    }
    else if (existsSync(defaultCjPath)) {
      code[lang] = readFileSync(defaultCjPath, 'utf-8')
    }
    else {
      code[lang] = ''
    }
  }

  // Serialize MDX for both locales
  const mdxSource: Record<string, any> = {}
  for (const [lang, md] of Object.entries({ zh: zhMd, en: enMd })) {
    mdxSource[lang] = await serialize(md, {
      mdxOptions: { remarkPlugins: [remarkGfm] },
    })
  }

  return {
    id: sectionId,
    name: {
      zh: readMarkdownTitle(zhMd, zhPath),
      en: readMarkdownTitle(enMd, enPath),
    },
    markdown: { zh: zhMd, en: enMd },
    code,
    mdxSource,
  }
}

async function loadSubChapter(subDir: string, subId: string): Promise<TourSubChapter> {
  const name = readNameJson(subDir)
  const entries = readdirSync(subDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && SECTION_DIR_RE.test(e.name))
    .sort((a, b) => compareIds(a.name, b.name))

  const sections = await Promise.all(entries.map(e => loadSection(join(subDir, e.name), e.name)))

  return { id: subId, name, sections }
}

async function loadChapter(chapterDir: string, chapterId: string): Promise<TourChapter> {
  const name = readNameJson(chapterDir)
  const entries = readdirSync(chapterDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && TOP_LEVEL_DIR_RE.test(e.name))
    .sort((a, b) => compareIds(a.name, b.name))

  const subChapters = await Promise.all(entries.map(e => loadSubChapter(join(chapterDir, e.name), e.name)))

  return { id: chapterId, name, subChapters }
}

let cachedTourData: TourChapter[] | null = null
let cachedFlatSections: FlatSection[] | null = null

export async function loadTourData(): Promise<TourChapter[]> {
  if (cachedTourData)
    return cachedTourData

  if (!existsSync(TOUR_DIR))
    return []

  const entries = readdirSync(TOUR_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && TOP_LEVEL_DIR_RE.test(e.name))
    .sort((a, b) => compareIds(a.name, b.name))

  cachedTourData = await Promise.all(entries.map(e => loadChapter(join(TOUR_DIR, e.name), e.name)))
  return cachedTourData
}

export function flattenSections(data: TourChapter[]): FlatSection[] {
  if (cachedFlatSections)
    return cachedFlatSections

  const flat: FlatSection[] = []

  for (const chapter of data) {
    let chapterStep = 1
    for (const sub of chapter.subChapters) {
      for (const section of sub.sections) {
        flat.push({
          chapterId: chapter.id,
          chapterSlug: stripOrderPrefix(chapter.id),
          chapterStep: String(chapterStep),
          chapterName: chapter.name,
          subChapterId: sub.id,
          subChapterName: sub.name,
          sectionId: section.id,
          sectionName: section.name,
          markdown: section.markdown,
          code: section.code,
          mdxSource: section.mdxSource,
        })
        chapterStep++
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
