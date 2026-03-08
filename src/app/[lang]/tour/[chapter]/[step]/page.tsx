import { flattenSections, getSlimTourData, loadTourData } from '@/tour/loader'
import TourWrapper from '@/components/tour/TourWrapper'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{
    lang: string
    chapter: string
    step: string
  }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, chapter, step } = await params
  const tourData = await loadTourData()
  const flat = flattenSections(tourData)
  const currentSection = flat.find(
    section => section.chapterSlug === chapter && section.chapterStep === step,
  )

  const sectionName = currentSection?.sectionName[lang] ?? 'Tour'

  return {
    title: lang === 'en'
      ? `${sectionName} - Cangjie Tour`
      : `${sectionName} - 仓颉之旅`,
  }
}

export async function generateStaticParams() {
  const tour = await loadTourData()
  const flat = flattenSections(tour)
  const locales = ['zh', 'en']

  return locales.flatMap(lang =>
    flat.map(section => ({
      lang,
      chapter: section.chapterSlug,
      step: section.chapterStep,
    })),
  )
}

export default async function TourStepPage({ params }: PageProps) {
  const { lang, chapter, step } = await params
  const tourData = await loadTourData()
  const flat = flattenSections(tourData)
  const initialIndex = flat.findIndex(
    section => section.chapterSlug === chapter && section.chapterStep === step,
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
