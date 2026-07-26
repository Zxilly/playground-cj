import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadStaticTourContentSections } from './static-tour-content-source'

function sourceByRef(
  sections: ReturnType<typeof loadStaticTourContentSections>,
  ref: string,
) {
  const section = sections.find(candidate =>
    `${candidate.chapterId}/${candidate.subChapterId}/${candidate.sectionId}` === ref)
  expect(section, ref).toBeDefined()
  return section!
}

describe('static tour editorial source facts', () => {
  it('loads identical content from LF and CRLF source trees', () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'static-tour-eol-'))
    const createTour = (name: string, newline: '\n' | '\r\n') => {
      const root = join(fixtureRoot, name)
      const chapter = join(root, '01-example')
      const subChapter = join(chapter, '01-basics')
      const section = join(subChapter, '01')
      mkdirSync(section, { recursive: true })
      writeFileSync(
        join(chapter, 'name.json'),
        JSON.stringify({ en: 'Example', zh: '示例' }),
      )
      writeFileSync(
        join(subChapter, 'name.json'),
        JSON.stringify({ en: 'Basics', zh: '基础' }),
      )
      for (const locale of ['en', 'zh']) {
        writeFileSync(
          join(section, `index.${locale}.mdx`),
          [`# Title`, '', 'First line.', 'Second line.'].join(newline),
        )
        writeFileSync(
          join(section, `index.${locale}.cj`),
          ['main() {', '    println("hello")', '}'].join(newline),
        )
      }
      return root
    }

    try {
      const lf = loadStaticTourContentSections(createTour('lf', '\n'))
      const crlf = loadStaticTourContentSections(createTour('crlf', '\r\n'))
      expect(crlf).toEqual(lf)
    }
    finally {
      rmSync(fixtureRoot, { force: true, recursive: true })
    }
  })

  it('keeps language comparisons technically accurate in both locales', () => {
    const sections = loadStaticTourContentSections()
    for (const ref of [
      '02-basics/01-bindings/01',
      '02-basics/02-bindings-types/01',
    ]) {
      const source = sourceByRef(sections, ref)
      expect(source.markdown.zh).toContain('`const` 不等同于编译时常量')
      expect(source.markdown.en).toContain('`const` does not mean compile-time constant')
    }

    for (const ref of [
      '02-basics/02-basic-types/03',
      '02-basics/02-bindings-types/07',
    ]) {
      const source = sourceByRef(sections, ref)
      for (const markdown of Object.values(source.markdown)) {
        expect(markdown).toContain('C99')
        expect(markdown).toContain('`_Bool`')
        expect(markdown).toContain('`<stdbool.h>`')
      }
    }

    const genericStruct = sourceByRef(sections, '06-generics/01-basics/02')
    expect(genericStruct.markdown.zh).toContain('Go 1.18 起')
    expect(genericStruct.markdown.en).toContain('Since Go 1.18')
    expect(genericStruct.markdown.zh).toContain('type Box[T any] struct')
    expect(genericStruct.markdown.en).toContain('type Box[T any] struct')

    const staticGeneric = sourceByRef(sections, '06-generics/01-basics/03')
    expect(staticGeneric.markdown.zh).toContain('不能引用泛型类的类级类型参数 `T`')
    expect(staticGeneric.markdown.en).toContain(
      'cannot reference a generic class\'s class-level type parameter `T`',
    )
    for (const markdown of Object.values(staticGeneric.markdown))
      expect(markdown).toContain('static <U> U identity(U value)')
  })
})
