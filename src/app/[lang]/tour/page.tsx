import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { flattenSections, loadTourData } from '@/tour/loader'
import { getSiteDomain, getTourPath } from '@/lib/siteHref'

interface PageProps {
  params: Promise<{ lang: string }>
}

export default async function TourIndexPage({ params }: PageProps) {
  const { lang } = await params
  const tourData = await loadTourData()
  const flat = flattenSections(tourData)
  const headersList = await headers()
  const host = headersList.get('host') ?? ''
  const servingDomain = getSiteDomain(host)

  if (flat.length > 0) {
    const first = flat[0]
    redirect(getTourPath(lang, {
      rest: [first.chapterSlug, first.chapterStep],
      servingDomain,
    }))
  }

  redirect(`/${lang}`)
}
