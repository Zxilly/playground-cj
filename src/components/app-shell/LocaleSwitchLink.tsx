'use client'

import type { ComponentPropsWithoutRef, MouseEvent, ReactNode } from 'react'
import { Globe } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useHydrated } from '@/hooks/useHydrated'
import { useLanguage } from '@/hooks/useLanguage'
import type { Locale } from '@/lib/i18n'
import { getLocaleHref } from '@/lib/siteHref'
import { cn } from '@/lib/utils'

const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export interface LocaleSwitchLinkProps extends Omit<ComponentPropsWithoutRef<'a'>, 'href' | 'children'> {
  /** Explicit current locale override; defaults to `useLanguage().locale`. */
  lang?: Locale
  /** Fallback pathname used during SSR when `usePathname` is unavailable. */
  fallbackPathname?: string
  /** Optional custom link content; defaults to `EN` or `中文`. */
  label?: ReactNode
  /** Whether to render the leading globe icon. Defaults to `true`. */
  showIcon?: boolean
}

export function LocaleSwitchLink({
  lang,
  fallbackPathname,
  label,
  showIcon = true,
  className,
  onClick,
  ...props
}: LocaleSwitchLinkProps) {
  const { locale } = useLanguage()
  const pathname = usePathname()
  const hydrated = useHydrated()

  const currentLocale: Locale = lang ?? locale
  const targetLocale: Locale = currentLocale === 'en' ? 'zh' : 'en'
  const defaultLabel = currentLocale === 'en' ? '中文' : 'EN'

  const location = hydrated
    ? window.location
    : { pathname: fallbackPathname ?? pathname ?? `/${currentLocale}` }

  const href = getLocaleHref(targetLocale, location)

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    document.cookie = `locale=${targetLocale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`
    onClick?.(event)
  }

  return (
    <a
      href={href}
      lang={targetLocale}
      hrefLang={targetLocale}
      aria-label={targetLocale === 'en' ? 'Switch to English' : '切换为中文'}
      onClick={handleClick}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-medium whitespace-nowrap text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-9',
        className,
      )}
      {...props}
    >
      {showIcon && <Globe aria-hidden="true" className="size-4 shrink-0" />}
      <span>{label ?? defaultLabel}</span>
    </a>
  )
}
