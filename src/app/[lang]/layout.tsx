import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { LinguiClientProvider } from '@/components/LinguiClientProvider'
import type { Locale } from '@/lib/i18n'

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

  // Load messages for client-side i18n
  const catalog = await import(`@/locales/${lang}/messages.mjs`)
  const messages = catalog.messages

  return (
    <LinguiClientProvider
      initialLocale={lang as Locale}
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
