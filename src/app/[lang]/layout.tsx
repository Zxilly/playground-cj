import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { uiFontFamily } from '@/app/font'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { notFound } from 'next/navigation'
import Script from 'next/script'
import { LinguiClientProvider } from '@/modules/i18n/LinguiClientProvider'
import { isLocale } from '@/lib/i18n'
import { localizedAlternates, PLAYGROUND_ORIGIN } from '@/lib/seo'
import '../globals.css'

interface LayoutProps {
  children: ReactNode
  params: Promise<{ lang: string }>
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { lang } = await params

  if (lang === 'en') {
    return {
      title: 'Cangjie Playground – Write and run Cangjie online',
      description: 'Write, format, run and share Cangjie code in your browser. Try examples with the online compiler and follow the interactive Cangjie Tour without installing an SDK.',
      alternates: localizedAlternates(PLAYGROUND_ORIGIN, lang),
    }
  }

  return {
    title: '仓颉 Playground：在线编写和运行仓颉代码',
    description: '在浏览器中编写、格式化、运行和分享仓颉代码，无需安装 SDK。通过在线编译器尝试代码示例，配合仓颉之旅交互教程学习编程语言。',
    alternates: localizedAlternates(PLAYGROUND_ORIGIN, lang),
  }
}

export default async function LangLayout({ children, params }: LayoutProps) {
  const { lang } = await params
  if (!isLocale(lang))
    notFound()

  const { messages } = await import(`@/locales/${lang}/messages.mjs`)
  const documentLanguage = lang === 'en' ? 'en' : 'zh-CN'

  return (
    <html lang={documentLanguage} suppressHydrationWarning>
      <head>
        {process.env.NODE_ENV === 'production' && (
          <Script id="track-routing" strategy="beforeInteractive">
            {`window.sanitizeCangjieAnalytics=function(type,payload){
          payload.url=location.pathname;
          if(payload.referrer){try{var ref=new URL(payload.referrer);payload.referrer=ref.origin+ref.pathname;}catch(e){payload.referrer='';}}
          return payload;
        };`}
          </Script>
        )}
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
        <LinguiClientProvider
          initialLocale={lang}
          initialMessages={messages}
        >
          {children}
        </LinguiClientProvider>
        {process.env.VERCEL === '1' && <Analytics />}
        {process.env.VERCEL === '1' && <SpeedInsights />}
      </body>
    </html>
  )
}

export async function generateStaticParams() {
  return [
    { lang: 'zh' },
    { lang: 'en' },
  ]
}
