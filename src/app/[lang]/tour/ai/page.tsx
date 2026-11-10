import type { Metadata } from 'next'
import TeachApp from '@/features/teach/components/TeachApp'
import { localizedAlternates, TOUR_ORIGIN } from '@/lib/seo'

interface PageProps {
  params: Promise<{
    lang: string
  }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params
  return {
    title: lang === 'en' ? 'AI Classroom - Cangjie Tour' : 'AI 课堂 - 仓颉之旅',
    description: lang === 'en'
      ? 'Practice Cangjie with guided lessons, code examples and an interactive AI classroom.'
      : '通过仓颉之旅 AI 课堂进行编程练习，结合课程讲解、代码示例与交互反馈学习仓颉。',
    alternates: localizedAlternates(TOUR_ORIGIN, lang, '/ai'),
  }
}

export async function generateStaticParams() {
  return [{ lang: 'zh' }, { lang: 'en' }]
}

export default async function TourAIPage({ params }: PageProps) {
  const { lang } = await params
  return (
    <main className="teach-workspace-root h-dvh overflow-hidden bg-background text-foreground">
      <TeachApp lang={lang} />
    </main>
  )
}
