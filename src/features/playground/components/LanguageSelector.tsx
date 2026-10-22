'use client'

import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { DeferredPopover } from './DeferredPopover'
import type { Locale } from '@/lib/i18n'
import { getLocaleHref } from '@/lib/siteHref'
import { ChevronsUpDown, Globe } from 'lucide-react'
import { useState } from 'react'
import { useLanguage } from '@/hooks/useLanguage'

const LanguageMenu = dynamic(() => import('./LanguageMenu'))

export function LanguageSelector() {
  const { locale } = useLanguage()
  const [open, setOpen] = useState(false)

  const handleLanguageChange = (newLocale: Locale) => {
    if (newLocale !== locale) {
      document.cookie = `locale=${newLocale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
      window.location.href = getLocaleHref(newLocale, window.location)
    }
    setOpen(false)
  }

  return (
    <DeferredPopover
      open={open}
      onOpenChange={setOpen}
      className="w-[180px] p-0"
      preventOpenAutoFocus
      trigger={(
        <Button
          variant="outline"
          role="combobox"
          aria-label={locale === 'zh' ? '中文' : 'English'}
          aria-expanded={open}
          className="min-h-11 w-auto justify-between lg:min-h-9"
        >
          <Globe className="mr-2 h-4 w-4" />
          {locale === 'zh' ? '中文' : 'English'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      )}
    >
      {open && <LanguageMenu locale={locale} onSelect={handleLanguageChange} />}
    </DeferredPopover>
  )
}
