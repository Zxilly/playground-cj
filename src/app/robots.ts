import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { getSiteDomain } from '@/lib/siteHref'
import { PLAYGROUND_ORIGIN, TOUR_ORIGIN } from '@/lib/seo'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = getSiteDomain((await headers()).get('host') ?? '') === 'tour' ? TOUR_ORIGIN : PLAYGROUND_ORIGIN
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/api/' },
    sitemap: `${origin}/sitemap.xml`,
  }
}
