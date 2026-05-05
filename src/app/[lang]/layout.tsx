import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { LinguiClientProvider } from '@/modules/i18n/LinguiClientProvider'
import { isLocale } from '@/lib/i18n'

interface LayoutProps {
  children: ReactNode
  params: Promise<{ lang: string }>
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { lang } = await params

  if (lang === 'en') {
    return {
      title: 'Cangjie Playground',
      description: 'An online playground for the Cangjie programming language',
    }
  }

  return {
    title: '仓颉 Playground',
    description: '一个在线的仓颉编程语言 Playground',
  }
}

export default async function LangLayout({ children, params }: LayoutProps) {
  const { lang } = await params
  if (!isLocale(lang))
    notFound()

  const { messages } = await import(`@/locales/${lang}/messages.mjs`)

  return (
    <LinguiClientProvider
      initialLocale={lang}
      initialMessages={messages}
    >
      {children}
    </LinguiClientProvider>
  )
}

export async function generateStaticParams() {
  return [
    { lang: 'zh' },
    { lang: 'en' },
  ]
}
