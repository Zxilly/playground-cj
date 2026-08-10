'use client'

import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { locales } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n'
import { getLocaleHref } from '@/lib/siteHref'
import { cn } from '@/lib/utils'
import { Check, ChevronsUpDown, Globe } from 'lucide-react'
import { useRef, useState } from 'react'
import { Trans } from '@lingui/react/macro'

import { useLanguage } from '@/hooks/useLanguage'

const languageNames: Record<Locale, { name: string, nativeName: string }> = {
  zh: { name: 'Chinese', nativeName: '中文' },
  en: { name: 'English', nativeName: 'English' },
}

function setLanguageCookie(locale: Locale) {
  document.cookie = `locale=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
}

function navigateToLocale(locale: Locale) {
  window.location.href = getLocaleHref(locale, window.location)
}

export function LanguageSelector() {
  const { locale } = useLanguage()
  const [open, setOpen] = useState(false)
  const [commandSession, setCommandSession] = useState(0)
  const popoverContentRef = useRef<HTMLDivElement>(null)

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen)
      setCommandSession(current => current + 1)
    setOpen(nextOpen)
  }

  const handleLanguageChange = (newLocale: Locale) => {
    if (newLocale !== locale) {
      setLanguageCookie(newLocale)
      navigateToLocale(newLocale)
    }
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="min-h-11 w-auto justify-between lg:min-h-9"
        >
          <Globe className="mr-2 h-4 w-4" />
          {languageNames[locale]?.nativeName || locale}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        ref={popoverContentRef}
        className="w-[180px] p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          requestAnimationFrame(() => {
            popoverContentRef.current
              ?.querySelector<HTMLElement>('[cmdk-root]')
              ?.focus()
          })
        }}
      >
        <Command
          key={commandSession}
          label={locale === 'zh' ? '选择语言' : 'Select language'}
          defaultValue={locale}
        >
          <CommandEmpty>
            <Trans>未找到语言。</Trans>
          </CommandEmpty>
          <CommandGroup>
            <CommandList>
              {locales.map(lang => (
                <CommandItem
                  key={lang}
                  value={lang}
                  className="min-h-11 lg:min-h-8"
                  onSelect={() => handleLanguageChange(lang as Locale)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      locale === lang ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {languageNames[lang].nativeName}
                </CommandItem>
              ))}
            </CommandList>
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
