import { Suspense } from 'react'
import { headers } from 'next/headers'
import Image from 'next/image'
import { BookOpen } from 'lucide-react'
import { setupI18n } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import Playground from '@/features/playground/components/Playground'
import { buttonVariants } from '@/components/ui/button'
import { fontFamily } from '@/app/font'
import { getTourHref } from '@/lib/siteHref'
import { getStarterCode } from '@/lib/monaco/starter-code'

async function CodePreview({ locale, sharedCode }: { locale: string, sharedCode?: Promise<string | undefined> }) {
  const code = await sharedCode ?? getStarterCode(locale)
  return (
    <pre data-testid="code-preview" className="m-0 overflow-hidden p-4 text-[15px] leading-5" style={{ fontFamily }}>
      <code>{code.split('\n', 40).join('\n').slice(0, 8000)}</code>
    </pre>
  )
}

export default async function Wrapper({ lang, sharedCode }: { lang: string, sharedCode?: Promise<string | undefined> }) {
  const locale = lang === 'en' ? 'en' : 'zh'
  const [{ messages }, requestHeaders] = await Promise.all([
    import(`@/locales/${locale}/messages.mjs`),
    headers(),
  ])
  // Each server render owns its locale; never activate the client singleton here.
  const i18n = setupI18n({ locale, messages: { [locale]: messages } })
  const host = requestHeaders.get('host') ?? ''
  const protocol = requestHeaders.get('x-forwarded-proto') === 'http' ? 'http' : 'https'
  const tourHref = getTourHref(locale, { currentOrigin: host ? `${protocol}://${host}` : undefined })
  const loading = <p role="status" className="p-4 text-sm text-muted-foreground">{i18n._(msg`正在加载编辑器…`)}</p>

  return (
    <Playground
      sharedCode={sharedCode}
      brand={(
        <div className="flex min-w-0 items-center lg:shrink-0">
          <Image src="/icon.png" alt="" width={32} height={32} className="m-2 size-6 lg:m-4 lg:size-8" />
          <h1 className="min-w-0 whitespace-nowrap text-base font-bold lg:text-2xl">{i18n._(msg`仓颉 Playground`)}</h1>
        </div>
      )}
      tourLink={(
        <a href={tourHref} className={`${buttonVariants({ variant: 'outline' })} min-h-11 w-full lg:min-h-9`}>
          <BookOpen className="mr-1 h-4 w-4" />
          {i18n._(msg`教程`)}
        </a>
      )}
      editorFallback={(
        <div className="absolute inset-0 overflow-hidden bg-background" aria-busy="true">
          <Suspense fallback={loading}>
            <CodePreview locale={locale} sharedCode={sharedCode} />
            {loading}
          </Suspense>
        </div>
      )}
      footer={(
        <footer className="flex-none p-4 pt-0 text-center text-sm text-muted-foreground">
          {i18n._(msg`仓颉 1.2.0 · STDX 1.2.0.1 ·\u00A0`)}
          <a
            href="https://github.com/Zxilly/playground-cj"
            className="inline-flex min-h-11 items-center justify-center px-1 hover:underline lg:min-h-0"
            target="_blank"
            rel="noopener noreferrer"
          >
            {i18n._(msg`在 GitHub 查看源代码`)}
          </a>
        </footer>
      )}
    />
  )
}
