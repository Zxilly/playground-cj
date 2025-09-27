import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { fontFamily } from '@/app/font'
import { Analytics } from '@vercel/analytics/react'
import './globals.css'

export const metadata: Metadata = {
  title: '仓颉 Playground',
  description: '一个在线的仓颉编程语言 Playground',
}

export default function RootLayout({ children }: Readonly<{
  children: ReactNode
}>) {
  return (
    <html>
      <body
        style={{
          fontFamily,
        }}
      >
        {children}
        <Analytics />
      </body>
    </html>
  )
}
