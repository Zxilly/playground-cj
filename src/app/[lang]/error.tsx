'use client'

import { useEffect } from 'react'
import { AlertTriangle, Home, RotateCcw } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/hooks/useLanguage'
import { getPlaygroundPath } from '@/lib/siteHref'

export interface LangErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function LangError({ error, reset }: LangErrorProps) {
  const { locale } = useLanguage()
  const homeHref = getPlaygroundPath(locale)
  const digest = error.digest

  useEffect(() => {
    console.error('[LangError]', error)
  }, [error])

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12 text-foreground">
      <div
        role="alert"
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm sm:p-8"
      >
        <div className="mb-4 inline-flex size-11 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10 text-error-foreground">
          <AlertTriangle aria-hidden="true" className="size-5" />
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          <Trans>页面加载出现问题</Trans>
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          <Trans>可能是网络波动或外部代码分享服务暂时不可用。你可以重试加载，或返回首页继续使用。</Trans>
        </p>
        {digest && (
          <p className="mt-3 rounded-md bg-muted px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
            <Trans>
              错误编号：
              {digest}
            </Trans>
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            onClick={reset}
            className="min-h-11 flex-1 gap-2 sm:flex-none lg:min-h-9"
          >
            <RotateCcw aria-hidden="true" className="size-4" />
            <Trans>重试</Trans>
          </Button>
          <Button
            variant="outline"
            asChild
            className="min-h-11 flex-1 gap-2 sm:flex-none lg:min-h-9"
          >
            <a href={homeHref}>
              <Home aria-hidden="true" className="size-4" />
              <Trans>返回首页</Trans>
            </a>
          </Button>
        </div>
      </div>
    </main>
  )
}
