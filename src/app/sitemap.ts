import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { getSiteDomain } from '@/lib/siteHref'
import { PLAYGROUND_ORIGIN, TOUR_ORIGIN } from '@/lib/seo'
import { flattenSections, loadTourData } from '@/tour/loader'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const isTour = getSiteDomain((await headers()).get('host') ?? '') === 'tour'
  const origin = isTour ? TOUR_ORIGIN : PLAYGROUND_ORIGIN
  const paths = isTour
    ? flattenSections(await loadTourData()).map(section => `/${section.chapterSlug}/${section.chapterStep}`)
    : ['']

  return paths.flatMap(path => ['zh', 'en'].map(lang => ({
    url: `${origin}/${lang}${path}`,
    alternates: {
      languages: {
        'zh-CN': `${origin}/zh${path}`,
        'en': `${origin}/en${path}`,
      },
    },
  })))
}
