'use client'

import { createContext, use, useMemo } from 'react'
import type { Locale } from '@/lib/i18n'
import { usePathname } from 'next/navigation'

interface LanguageContextType {
  locale: Locale
  isLoading: boolean
}

export const LanguageContext = createContext<LanguageContextType>({ locale: 'zh', isLoading: false })

export function useLanguage() {
  const context = use(LanguageContext)
  const pathname = usePathname()

  // Extract locale from pathname for RSC setup
  const locale = useMemo(() => {
    const pathSegments = pathname.split('/').filter(Boolean)
    const firstSegment = pathSegments[0]

    if (firstSegment === 'en' || firstSegment === 'zh') {
      return firstSegment as Locale
    }

    return context.locale
  }, [pathname, context.locale])

  return {
    ...context,
    locale,
  }
}
