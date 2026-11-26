'use client'

import { useEffect, useRef } from 'react'
import { Check } from 'lucide-react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command'
import { locales } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export default function LanguageMenu({ locale, onSelect }: { locale: Locale, onSelect: (locale: Locale) => void }) {
  const { t } = useLingui()
  const commandRef = useRef<HTMLDivElement>(null)
  // The chunk can arrive after the popover's auto-focus event.
  useEffect(() => commandRef.current?.focus(), [])

  return (
    <Command ref={commandRef} label={t`选择语言`} defaultValue={locale}>
      <CommandEmpty><Trans>未找到语言。</Trans></CommandEmpty>
      <CommandGroup>
        <CommandList>
          {locales.map(lang => (
            <CommandItem key={lang} value={lang} className="min-h-11 lg:min-h-8" onSelect={() => onSelect(lang)}>
              <Check className={cn('mr-2 h-4 w-4', locale === lang ? 'opacity-100' : 'opacity-0')} />
              {lang === 'zh' ? '中文' : 'English'}
            </CommandItem>
          ))}
        </CommandList>
      </CommandGroup>
    </Command>
  )
}
