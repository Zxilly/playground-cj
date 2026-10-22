import { describe, expect, it } from 'vitest'
import { getClientTourSections } from './client-data'
import type { FlatSection } from './types'

const section: FlatSection = {
  chapterId: '01-welcome',
  chapterSlug: 'welcome',
  chapterStep: '1',
  chapterName: { zh: '入门', en: 'Welcome' },
  subChapterId: '01-intro',
  subChapterName: { zh: '开始', en: 'Start' },
  sectionId: '1',
  sectionName: { zh: '你好', en: 'Hello' },
  markdown: { zh: '# 你好', en: '# Hello' },
  code: { zh: 'println("你好")', en: 'println("Hello")' },
  mdxSource: {
    zh: { compiledSource: 'compiled Chinese lesson' },
    en: { compiledSource: 'compiled English lesson' },
  },
}

describe('client tour content', () => {
  it.each(['zh', 'en'])('sends only %s compiled content and code, preserving navigation metadata', (lang) => {
    const [client] = getClientTourSections([section], lang)
    expect(client).toEqual({
      ...section,
      markdown: {},
      code: { [lang]: section.code[lang] },
      mdxSource: { [lang]: section.mdxSource![lang] },
    })
    expect(section.markdown).toEqual({ zh: '# 你好', en: '# Hello' })
    expect(Object.keys(section.mdxSource!)).toEqual(['zh', 'en'])
  })

  it('keeps the Chinese fallback for missing translated code and compiled content', () => {
    const [client] = getClientTourSections([{
      ...section,
      code: { zh: section.code.zh },
      mdxSource: { zh: section.mdxSource!.zh },
    }], 'en')
    expect(client.code.en).toBe(section.code.zh)
    expect(client.mdxSource?.en).toBe(section.mdxSource!.zh)
  })

  it('retains raw Markdown only when compiled content is unavailable', () => {
    const [translated, fallback] = getClientTourSections([
      { ...section, mdxSource: undefined },
      { ...section, mdxSource: undefined, markdown: { zh: section.markdown.zh }, code: {} },
    ], 'en')
    expect(translated.markdown).toEqual({ en: '# Hello' })
    expect(fallback.markdown).toEqual({ en: '# 你好' })
    expect(fallback.code).toEqual({ en: '' })
  })
})
