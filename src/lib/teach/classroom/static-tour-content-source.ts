import {
  existsSync,
  readdirSync,
  readFileSync,
} from 'node:fs'
import { join } from 'node:path'
import type { FlatSection } from '@/tour/types'

const TOP_LEVEL_DIRECTORY = /^\d+-[a-z0-9-]+$/
const SECTION_DIRECTORY = /^\d+$/
const ORDER_PREFIX = /^\d+-/

function normalizeNewlines(source: string): string {
  return source.replace(/\r\n?/g, '\n')
}

function compareIds(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true })
}

function readRequired(path: string): string {
  if (!existsSync(path))
    throw new Error(`Missing required Static Tour source: ${path}`)
  return normalizeNewlines(readFileSync(path, 'utf8'))
}

function readName(directory: string): Record<string, string> {
  const path = join(directory, 'name.json')
  const parsed = JSON.parse(readRequired(path)) as Record<string, unknown>
  const zh = typeof parsed.zh === 'string' ? parsed.zh.trim() : ''
  const en = typeof parsed.en === 'string' ? parsed.en.trim() : ''
  if (!zh || !en)
    throw new Error(`Invalid bilingual Static Tour name: ${path}`)
  return { zh, en }
}

function sourcePath(directory: string, locale: 'zh' | 'en'): string {
  const mdx = join(directory, `index.${locale}.mdx`)
  return existsSync(mdx) ? mdx : join(directory, `index.${locale}.md`)
}

function markdownTitle(markdown: string, path: string): string {
  const [firstLine = ''] = markdown.replace(/^\uFEFF/, '').split(/\r?\n/, 1)
  if (!firstLine.startsWith('# ') || !firstLine.slice(2).trim())
    throw new Error(`Missing top-level Markdown heading in ${path}`)
  return firstLine.slice(2).trim()
}

function localizedCode(
  directory: string,
  locale: 'zh' | 'en',
): string {
  const localized = join(directory, `index.${locale}.cj`)
  const fallback = join(directory, 'index.cj')
  if (existsSync(localized))
    return normalizeNewlines(readFileSync(localized, 'utf8'))
  return existsSync(fallback)
    ? normalizeNewlines(readFileSync(fallback, 'utf8'))
    : ''
}

/**
 * Read only the repository-authored source fields needed by the offline Course
 * Content Pack generator. MDX compilation remains outside this build pipeline.
 */
export function loadStaticTourContentSections(
  root = join(process.cwd(), 'tour'),
): FlatSection[] {
  if (!existsSync(root))
    throw new Error(`Static Tour source directory is unavailable: ${root}`)

  const sections: FlatSection[] = []
  const chapters = readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && TOP_LEVEL_DIRECTORY.test(entry.name))
    .sort((left, right) => compareIds(left.name, right.name))

  for (const chapter of chapters) {
    const chapterDirectory = join(root, chapter.name)
    const chapterName = readName(chapterDirectory)
    let chapterStep = 1
    const subChapters = readdirSync(chapterDirectory, { withFileTypes: true })
      .filter(entry =>
        entry.isDirectory() && TOP_LEVEL_DIRECTORY.test(entry.name))
      .sort((left, right) => compareIds(left.name, right.name))

    for (const subChapter of subChapters) {
      const subChapterDirectory = join(chapterDirectory, subChapter.name)
      const subChapterName = readName(subChapterDirectory)
      const sectionDirectories = readdirSync(
        subChapterDirectory,
        { withFileTypes: true },
      )
        .filter(entry =>
          entry.isDirectory() && SECTION_DIRECTORY.test(entry.name))
        .sort((left, right) => compareIds(left.name, right.name))

      for (const section of sectionDirectories) {
        const sectionDirectory = join(subChapterDirectory, section.name)
        const zhPath = sourcePath(sectionDirectory, 'zh')
        const enPath = sourcePath(sectionDirectory, 'en')
        const zhMarkdown = readRequired(zhPath)
        const enMarkdown = readRequired(enPath)
        sections.push({
          chapterId: chapter.name,
          chapterSlug: chapter.name.replace(ORDER_PREFIX, ''),
          chapterStep: String(chapterStep),
          chapterName,
          subChapterId: subChapter.name,
          subChapterName,
          sectionId: section.name,
          sectionName: {
            zh: markdownTitle(zhMarkdown, zhPath),
            en: markdownTitle(enMarkdown, enPath),
          },
          markdown: {
            zh: zhMarkdown,
            en: enMarkdown,
          },
          code: {
            zh: localizedCode(sectionDirectory, 'zh'),
            en: localizedCode(sectionDirectory, 'en'),
          },
        })
        chapterStep += 1
      }
    }
  }
  return sections
}
