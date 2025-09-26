import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { StaticLanguageProvider } from '@/components/StaticLanguageProvider'

export const metadata: Metadata = {
  title: 'Cangjie Playground',
  description: 'An online playground for the Cangjie programming language',
}

export default function EnglishLayout({ children }: Readonly<{
  children: ReactNode
}>) {
  return (
    <StaticLanguageProvider>
      {children}
    </StaticLanguageProvider>
  )
}