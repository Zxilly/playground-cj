import type { FlatSection } from './types'

/** Keep instant lesson navigation without sending a second copy of the course. */
export function getClientTourSections(sections: FlatSection[], lang: string): FlatSection[] {
  return sections.map((section) => {
    const source = section.mdxSource?.[lang] || section.mdxSource?.zh
    return {
      ...section,
      // Compiled MDX already contains the lesson text. Raw Markdown is only
      // needed for sections without a compiled source.
      markdown: source ? {} : { [lang]: section.markdown[lang] || section.markdown.zh || '' },
      code: { [lang]: section.code[lang] || section.code.zh || '' },
      mdxSource: source ? { [lang]: source } : undefined,
    }
  })
}
