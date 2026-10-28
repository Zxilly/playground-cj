'use client'

import { ALL_LANGUAGES, LANGUAGE_LABELS, useKnownLanguagesStore } from '@/stores/knownLanguages'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ChevronDown, Settings2 } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import { t } from '@lingui/core/macro'

const LANGUAGES = ALL_LANGUAGES.map(id => ({ id, label: LANGUAGE_LABELS[id] }))

export function LanguagePicker() {
  const knownLanguages = useKnownLanguagesStore(state => state.knownLanguages)
  const toggleLanguage = useKnownLanguagesStore(state => state.toggleLanguage)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          data-tour-highlight="langpicker"
          aria-label={t`选择对比语言`}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md border border-border bg-background px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Settings2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="max-w-20 truncate sm:max-w-32" title={knownLanguages.map(lang => LANGUAGE_LABELS[lang]).join(', ')}>
            {knownLanguages.length > 0
              ? knownLanguages.map(lang => LANGUAGE_LABELS[lang]).join(', ')
              : <Trans>对比语言</Trans>}
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-3">
        <div className="text-sm font-semibold mb-2 text-foreground">
          <Trans>我熟悉的语言</Trans>
        </div>
        <div className="text-xs text-muted-foreground mb-3">
          <Trans>勾选后，教程会显示对应语言的对比说明。</Trans>
        </div>
        <div className="space-y-1">
          {LANGUAGES.map(({ id, label }) => (
            <label
              key={id}
              className="flex min-h-11 items-center gap-2.5 px-2 py-1.5 rounded hover:bg-accent cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={knownLanguages.includes(id)}
                onChange={() => toggleLanguage(id)}
                className="rounded border-border accent-tour-teal"
              />
              <span className="text-sm text-foreground">{label}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
