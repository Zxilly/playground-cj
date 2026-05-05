import { describe, expect, it } from 'vitest'
import { createAIClassroomSections } from './section-payload'
import type { FlatSection } from '@/tour/types'

function section(id: string): FlatSection {
  return {
    chapterId: '02-basics',
    chapterSlug: 'basics',
    chapterStep: id,
    chapterName: { zh: '基础', en: 'Basics' },
    subChapterId: '01-bindings',
    subChapterName: { zh: '变量绑定', en: 'Bindings' },
    sectionId: id,
    sectionName: { zh: `章节 ${id}`, en: `Section ${id}` },
    markdown: {
      zh: '#'.repeat(10_000),
      en: '#'.repeat(10_000),
    },
    code: {
      zh: 'main() {}',
      en: 'main() {}',
    },
    mdxSource: {
      zh: { compiledSource: 'x'.repeat(10_000) },
      en: { compiledSource: 'x'.repeat(10_000) },
    },
  }
}

describe('ai classroom section payload', () => {
  it('keeps only lightweight current-section metadata for the client AI app', () => {
    const payload = createAIClassroomSections([section('1'), section('2')])

    expect(payload).toHaveLength(1)
    expect(payload[0]).toMatchObject({
      sectionId: '1',
      sectionName: { zh: '章节 1', en: 'Section 1' },
      markdown: { zh: '', en: '' },
      code: { zh: 'main() {}', en: 'main() {}' },
    })
    expect(payload[0]).not.toHaveProperty('mdxSource')
    expect(JSON.stringify(payload)).not.toContain('#'.repeat(100))
    expect(JSON.stringify(payload)).not.toContain('x'.repeat(100))
  })
})
