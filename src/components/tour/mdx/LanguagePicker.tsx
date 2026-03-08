'use client'

import { useKnownLanguages } from '@/contexts/useKnownLanguages'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Settings2 } from 'lucide-react'
import { Trans } from '@lingui/react/macro'

const LANGUAGES = [
  { id: 'c', label: 'C' },
  { id: 'java', label: 'Java' },
  { id: 'go', label: 'Go' },
  { id: 'rust', label: 'Rust' },
] as const

export function LanguagePicker() {
  const { knownLanguages, toggleLanguage } = useKnownLanguages()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          data-tour-highlight="langpicker"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-medium text-white hover:bg-white/15 rounded transition-colors"
        >
          <Settings2 className="size-4" />
          <span className="hidden sm:inline">
            {knownLanguages.size > 0
              ? Array.from(knownLanguages).map(l => l.charAt(0).toUpperCase() + l.slice(1)).join(', ')
              : <Trans>对比</Trans>}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-3">
        <div className="text-sm font-semibold mb-2 text-foreground">
          <Trans>我了解这些语言</Trans>
        </div>
        <div className="text-xs text-muted-foreground mb-3">
          <Trans>对比内容将出现在文中。</Trans>
        </div>
        <div className="space-y-1">
          {LANGUAGES.map(({ id, label }) => (
            <label
              key={id}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-accent cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={knownLanguages.has(id as any)}
                onChange={() => toggleLanguage(id as any)}
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
