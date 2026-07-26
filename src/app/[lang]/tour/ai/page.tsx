import type { Metadata } from 'next'
import TeachApp from '@/features/teach/components/TeachApp'

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
    <main className="teach-workspace-root h-dvh overflow-hidden bg-background text-foreground">
      <TeachApp lang={lang} />
    </main>
  )
}
