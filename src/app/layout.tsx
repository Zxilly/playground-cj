import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { uiFontFamily } from '@/app/font'
import { Analytics } from '@vercel/analytics/react'
import './globals.css'
import TrackingScript from '@/modules/analytics/TrackingScript'
import { SpeedInsights } from '@vercel/speed-insights/next'

export const metadata: Metadata = {
  title: '仓颉 Playground',
  description: '一个在线的仓颉编程语言 Playground',
}

export default function RootLayout({ children }: Readonly<{
  children: ReactNode
}>) {
  return (
    <html suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem('classroom-theme-mode')||'auto';var d=m==='dark'||(m==='auto'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body
        style={{
          fontFamily: uiFontFamily,
        }}
      >
        {children}
        <Analytics />
        <TrackingScript />
        <SpeedInsights />
      </body>
    </html>
  )
}
