import { headers } from 'next/headers'
import Image from 'next/image'
import { BookOpen } from 'lucide-react'
import { setupI18n } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import Playground from '@/features/playground/components/Playground'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getTourHref } from '@/lib/siteHref'

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
        <div data-testid="editor-loading" role="status" className="absolute inset-0 z-10 overflow-hidden bg-background" aria-busy="true">
          <span className="sr-only">{i18n._(msg`正在加载编辑器…`)}</span>
          <div aria-hidden="true" className="max-w-md space-y-3 p-4">
            <Skeleton className="mb-6 h-3 w-1/2 bg-muted motion-reduce:animate-none" />
            <Skeleton className="h-3 w-2/5 bg-muted motion-reduce:animate-none" />
            <Skeleton className="ml-4 h-3 w-3/5 bg-muted motion-reduce:animate-none" />
            <Skeleton className="ml-4 h-3 w-1/3 bg-muted motion-reduce:animate-none" />
            <Skeleton className="h-3 w-8 bg-muted motion-reduce:animate-none" />
          </div>
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
