import TourAIWrapper from '@/features/tour-ai/components/TourAIWrapper'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{
    lang: string
  }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params
  return {
    title: lang === 'en' ? 'AI Classroom - Cangjie Tour' : 'AI 课堂 - 仓颉之旅',
  }
}

export async function generateStaticParams() {
  return [{ lang: 'zh' }, { lang: 'en' }]
}

export default async function TourAIPage({ params }: PageProps) {
  const { lang } = await params
  return (
    <main>
      <TourAIWrapper lang={lang} />
    </main>
  )
}
