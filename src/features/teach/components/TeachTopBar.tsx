'use client'

import { Trans, useLingui } from '@lingui/react/macro'
import { ArrowLeft, GraduationCap } from 'lucide-react'
import type { ReactNode } from 'react'
import { AppNavLinks, LocaleSwitchLink, ThemeToggle } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { useHydrated } from '@/hooks/useHydrated'
import { useLanguage } from '@/hooks/useLanguage'
import type { Locale } from '@/lib/i18n'
import { PLAYGROUND_ORIGIN } from '@/lib/seo'
import { getTourAIHref } from '@/lib/siteHref'

export interface TeachTopBarProps {
  actions?: ReactNode
  backLabel?: string
  backTestId?: string
  lang?: Locale
  onBack?: () => void
}

/** Shared classroom chrome for onboarding and the entered workspace. */
export function TeachTopBar({ actions, backLabel, backTestId, lang, onBack }: TeachTopBarProps) {
  const { locale } = useLanguage()
  const hydrated = useHydrated()
  const { t } = useLingui()
  const currentLocale: Locale = lang ?? locale
  const currentOrigin = hydrated ? window.location.origin : PLAYGROUND_ORIGIN
  const brandHref = getTourAIHref(currentLocale, { currentOrigin })

  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-3 sm:gap-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        {onBack && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            data-testid={backTestId}
            aria-label={backLabel}
            onClick={onBack}
            className="size-11 shrink-0 rounded-md text-muted-foreground lg:size-8"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
          </Button>
        )}
        <a
          href={brandHref}
          aria-label={t`AI 课堂`}
          className="flex min-h-11 min-w-0 items-center gap-2 rounded-md px-1 text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-9"
        >
          <span className="grid size-7 shrink-0 place-items-center text-primary">
            <GraduationCap aria-hidden="true" className="size-5" />
          </span>
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="truncate text-sm font-bold tracking-tight">
              <Trans>AI 课堂</Trans>
            </span>
            <span className="hidden text-xs text-muted-foreground xl:inline">
              <Trans>仓颉之旅</Trans>
            </span>
          </span>
        </a>
        <AppNavLinks
          active="ai"
          lang={currentLocale}
          className="hidden sm:flex"
        />
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        {actions}
        <ThemeToggle />
        <LocaleSwitchLink lang={currentLocale} showIcon={false} className="px-2 text-xs sm:px-2.5 sm:text-sm" />
      </div>
    </header>
  )
}
