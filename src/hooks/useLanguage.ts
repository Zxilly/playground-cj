'use client'

import { createContext, use, useMemo } from 'react'
import { isLocale } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n'
import { usePathname } from 'next/navigation'

interface LanguageContextType {
  locale: Locale
}

export const LanguageContext = createContext<LanguageContextType>({ locale: 'zh' })

export function useLanguage(): LanguageContextType {
  const context = use(LanguageContext)
  const pathname = usePathname()

  const locale = useMemo(() => {
    const firstSegment = pathname.split('/').filter(Boolean)[0]
    return isLocale(firstSegment) ? firstSegment : context.locale
  }, [pathname, context.locale])

  return { locale }
}
