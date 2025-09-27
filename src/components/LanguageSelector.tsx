'use client'

import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { i18n, locales } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Check, ChevronsUpDown, Globe } from 'lucide-react'
import * as React from 'react'
import { Trans } from '@lingui/react/macro'
import { t } from '@lingui/core/macro'

import { useLanguage } from '@/hooks/useLanguage'

const languageNames: Record<Locale, { name: string, nativeName: string }> = {
  zh: { name: 'Chinese', nativeName: '中文' },
  en: { name: 'English', nativeName: 'English' },
}

function setLanguageCookie(locale: Locale) {
  document.cookie = `locale=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
}

function navigateToLocale(locale: Locale) {
  const currentPath = window.location.pathname
  const currentSearch = window.location.search
  const currentHash = window.location.hash

  // Extract the current locale from the path
  const pathSegments = currentPath.split('/').filter(Boolean)
  const currentLocale = (pathSegments[0] === 'en' || pathSegments[0] === 'zh') ? pathSegments[0] : null

  let newPath: string

  if (currentLocale) {
    // Replace existing locale with new locale
    pathSegments[0] = locale
    newPath = `/${pathSegments.join('/')}`
  }
  else {
    // Add locale to path
    newPath = `/${locale}${currentPath}`
  }

  const newUrl = `${newPath}${currentSearch}${currentHash}`
  window.location.href = newUrl
}

export function LanguageSelector() {
  const { locale } = useLanguage()
  const [open, setOpen] = React.useState(false)

  const handleLanguageChange = (newLocale: Locale) => {
    if (newLocale !== locale) {
      setLanguageCookie(newLocale)
      navigateToLocale(newLocale)
    }
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full sm:w-auto justify-between"
        >
          <Globe className="mr-2 h-4 w-4" />
          {languageNames[locale]?.nativeName || locale}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[180px] p-0">
        <Command>
          <CommandInput placeholder={i18n._(t`搜索语言...`)} />
          <CommandEmpty>
            <Trans>未找到语言。</Trans>
          </CommandEmpty>
          <CommandGroup>
            <CommandList>
              {locales.map(lang => (
                <CommandItem
                  key={lang}
                  value={lang}
                  onSelect={() => handleLanguageChange(lang as Locale)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      locale === lang ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <div className="flex items-center">
                    <span>{languageNames[lang].nativeName}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandList>
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
