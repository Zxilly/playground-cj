import type { Metadata } from 'next'
import type { FlatSection } from '@/tour/types'

export const PLAYGROUND_ORIGIN = 'https://play.cj.zxilly.com'
export const TOUR_ORIGIN = 'https://tour.cj.zxilly.dev'

export function localizedAlternates(origin: string, lang: string, suffix = ''): Metadata['alternates'] {
  return {
    canonical: `${origin}/${lang}${suffix}`,
    languages: {
      'zh-CN': `${origin}/zh${suffix}`,
      'en': `${origin}/en${suffix}`,
    },
  }
}

export function lessonDescription(section: FlatSection, lang: string): string {
  const title = section.sectionName[lang] ?? section.sectionName.zh
  const chapter = section.chapterName[lang] ?? section.chapterName.zh
  // A complete, localized summary avoids arbitrary truncation inside MDX or code.
  return lang === 'en'
    ? `Learn ${title} in the ${chapter} chapter of the Cangjie Tour. Read the explanation, edit the Cangjie example, and run it online without installing an SDK.`
    : `学习仓颉之旅「${chapter}」章节中的「${title}」：阅读语法讲解，修改仓颉示例代码并在线运行，无需安装 SDK。`
}
