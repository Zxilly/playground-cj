'use client'

import { useEffect, useMemo, useRef } from 'react'
import { Trans } from '@lingui/react/macro'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Check } from 'lucide-react'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { getLocalizedExamples } from '@/const'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/hooks/useLanguage'

interface ExamplesMenuProps {
  selectedKey: string
  onSelect: (key: string, name: string, content: string) => void
}

export default function ExamplesMenu({ selectedKey, onSelect }: ExamplesMenuProps) {
  const { i18n } = useLingui()
  const { locale } = useLanguage()
  const examples = useMemo(() => getLocalizedExamples(locale), [locale])
  const inputRef = useRef<HTMLInputElement>(null)

  // The menu can arrive after the popover's focus event on a cold load.
  useEffect(() => inputRef.current?.focus(), [])

  return (
    <Command label={i18n._(msg`搜索示例`)} defaultValue={examples[selectedKey]?.name ?? selectedKey}>
      <CommandInput ref={inputRef} placeholder={i18n._(msg`搜索示例...`)} />
      <CommandEmpty><Trans>未找到示例。</Trans></CommandEmpty>
      <CommandGroup>
        <CommandList>
          {Object.entries(examples).map(([key, example]) => (
            <CommandItem
              key={key}
              value={example.name}
              className="min-h-11 lg:min-h-8"
              onSelect={() => onSelect(key, example.name, example.content)}
            >
              <Check className={cn('mr-2 h-4 w-4', selectedKey === key ? 'opacity-100' : 'opacity-0')} />
              {example.name}
            </CommandItem>
          ))}
        </CommandList>
      </CommandGroup>
    </Command>
  )
}
