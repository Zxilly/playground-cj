'use client'

import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { locales, type Locale } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Check, ChevronsUpDown, Globe } from 'lucide-react'
import * as React from 'react'
import { Trans } from '@lingui/react/macro'
import { t } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { useLanguage } from '@/components/StaticLanguageProvider'

const languageNames: Record<Locale, { name: string; nativeName: string }> = {
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

  let newPath: string

  if (locale === 'zh') {
    // For Chinese, use root path
    if (currentPath.startsWith('/en')) {
      newPath = currentPath.replace(/^\/en/, '') || '/'
    } else {
      newPath = currentPath
    }
  } else {
    // For English, use /en prefix
    if (currentPath.startsWith('/en')) {
      newPath = currentPath
    } else {
      newPath = currentPath === '/' ? '/en' : `/en${currentPath}`
    }
  }

  const newUrl = `${newPath}${currentSearch}${currentHash}`
  window.location.href = newUrl
}

export function LanguageSelector() {
  const { locale } = useLanguage()
  const [open, setOpen] = React.useState(false)
  const { _ } = useLingui()

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
          <CommandInput placeholder={_(t`搜索语言...`)} />
          <CommandEmpty>
            <Trans>未找到语言。</Trans>
          </CommandEmpty>
          <CommandGroup>
            <CommandList>
              {locales.map((lang) => (
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