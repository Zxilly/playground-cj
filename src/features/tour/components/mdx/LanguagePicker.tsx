'use client'

import { ALL_LANGUAGES, LANGUAGE_LABELS, useKnownLanguagesStore } from '@/stores/knownLanguages'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Settings2 } from 'lucide-react'
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
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-medium text-white hover:bg-white/15 rounded transition-colors"
        >
          <Settings2 className="size-4" />
          <span className="hidden sm:inline">
            {knownLanguages.length > 0
              ? knownLanguages.map(lang => LANGUAGE_LABELS[lang]).join(', ')
              : <Trans>对比</Trans>}
          </span>
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
              className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-accent cursor-pointer transition-colors"
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
