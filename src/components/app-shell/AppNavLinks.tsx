'use client'

import type { ReactNode } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { useHydrated } from '@/hooks/useHydrated'
import { useLanguage } from '@/hooks/useLanguage'
import type { Locale } from '@/lib/i18n'
import { PLAYGROUND_ORIGIN, TOUR_ORIGIN } from '@/lib/seo'
import { getPlaygroundHref, getTourAIHref, getTourHref } from '@/lib/siteHref'
import type { SiteDomain } from '@/lib/siteHref'
import { cn } from '@/lib/utils'

export type AppNavTarget = 'playground' | 'tour' | 'ai'

export interface AppNavLinksProps {
  /** Currently active section to mark with `aria-current="page"`. */
  active: AppNavTarget
  /** Explicit locale override; defaults to `useLanguage().locale`. */
  lang?: Locale
  /** Serving domain hint used during SSR before `window.location` is read. */
  servingDomain?: SiteDomain
  /** Optional topic slug forwarded to the AI Classroom link. */
  aiTopic?: string
  /** Optional className for the `<nav>` container. */
  className?: string
  /** Optional className applied to every navigation link. */
  linkClassName?: string
  /** Optional className merged into the active navigation link. */
  activeLinkClassName?: string
}

interface NavItem {
  id: AppNavTarget
  href: string
  label: ReactNode
  title?: string
}

export function AppNavLinks({
  active,
  lang,
  servingDomain = 'playground',
  aiTopic,
  className,
  linkClassName,
  activeLinkClassName,
}: AppNavLinksProps) {
  const { locale } = useLanguage()
  const hydrated = useHydrated()
  const { t } = useLingui()
  const currentLocale = lang ?? locale

  const currentOrigin = hydrated
    ? window.location.origin
    : servingDomain === 'tour'
      ? TOUR_ORIGIN
      : PLAYGROUND_ORIGIN

  const items: NavItem[] = [
    {
      id: 'playground',
      href: getPlaygroundHref(currentLocale, { currentOrigin }),
      label: 'Playground',
    },
    {
      id: 'tour',
      href: getTourHref(currentLocale, { currentOrigin }),
      label: <Trans>仓颉之旅</Trans>,
    },
    {
      id: 'ai',
      href: getTourAIHref(currentLocale, { currentOrigin, servingDomain, topic: aiTopic }),
      label: <Trans>AI 课堂</Trans>,
      title: active === 'ai' ? undefined : t`打开 AI 课堂，从当前教程主题开始学习和练习。`,
    },
  ]

  return (
    <nav
      aria-label={t`主导航`}
      className={cn('flex items-center gap-1', className)}
    >
      {items.map((item) => {
        const isActive = item.id === active
        return (
          <a
            key={item.id}
            href={item.href}
            title={item.title}
            aria-current={isActive ? 'page' : undefined}
            data-active={isActive ? 'true' : undefined}
            className={cn(
              'inline-flex min-h-11 items-center rounded-md px-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-9',
              linkClassName,
              isActive && cn('bg-accent text-accent-foreground', activeLinkClassName),
            )}
          >
            {item.label}
          </a>
        )
      })}
    </nav>
  )
}
