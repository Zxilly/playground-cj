import { redirect } from 'next/navigation'
import { flattenSections, loadTourData } from '@/tour/loader'

interface PageProps {
  params: Promise<{ lang: string }>
}

export default async function TourIndexPage({ params }: PageProps) {
  const { lang } = await params
  const tourData = loadTourData()
  const flat = flattenSections(tourData)

  if (flat.length > 0) {
    const first = flat[0]
    redirect(`/${lang}/tour/${first.chapterId}/${first.subChapterId}/${first.sectionId}`)
  }

  redirect(`/${lang}`)
}
