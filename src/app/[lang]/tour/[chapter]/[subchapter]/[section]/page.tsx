import { flattenSections, getSlimTourData, loadTourData } from '@/tour/loader'
import TourWrapper from '@/components/tour/TourWrapper'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{
    lang: string
    chapter: string
    subchapter: string
    section: string
  }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, chapter, subchapter, section } = await params
  const tourData = loadTourData()
  const flat = flattenSections(tourData)
  const currentSection = flat.find(
    s => s.chapterId === chapter && s.subChapterId === subchapter && s.sectionId === section,
  )

  const sectionName = currentSection?.sectionName[lang] ?? 'Tour'

  return {
    title: lang === 'en'
      ? `${sectionName} - Cangjie Tour`
      : `${sectionName} - 仓颉之旅`,
  }
}

export async function generateStaticParams() {
  const tour = loadTourData()
  const locales = ['zh', 'en']

  return locales.flatMap(lang =>
    tour.flatMap(chapter =>
      chapter.subChapters.flatMap(sub =>
        sub.sections.map(section => ({
          lang,
          chapter: chapter.id,
          subchapter: sub.id,
          section: section.id,
        })),
      ),
    ),
  )
}

export default async function TourStepPage({ params }: PageProps) {
  const { lang, chapter, subchapter, section } = await params
  const tourData = loadTourData()
  const flat = flattenSections(tourData)
  const initialIndex = flat.findIndex(
    s => s.chapterId === chapter && s.subChapterId === subchapter && s.sectionId === section,
  )

  if (initialIndex === -1) {
    notFound()
  }

  const slimTourData = getSlimTourData(tourData)
  const headersList = await headers()
  const host = headersList.get('host') ?? ''
  const isTourDomain = host.startsWith('tour.')

  return (
    <main>
      <TourWrapper
        lang={lang}
        tourData={slimTourData}
        allSections={flat}
        initialIndex={initialIndex}
        isTourDomain={isTourDomain}
      />
    </main>
  )
}
