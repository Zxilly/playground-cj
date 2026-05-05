'use client'

import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getLocalizedExamples } from '@/const'
import { cn } from '@/lib/utils'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Trans } from '@lingui/react/macro'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { useLanguage } from '@/hooks/useLanguage'

interface ExamplesDropdownProps {
  action: (nextCode: string) => void
}

export function ExamplesDropdown({ action }: ExamplesDropdownProps) {
  const { i18n } = useLingui()
  const { locale } = useLanguage()
  const [open, setOpen] = useState(false)
  const [selectedKey, setSelectedKey] = useState('hello-world')

  const examples = useMemo(() => getLocalizedExamples(locale), [locale])
  const selectedExample = examples[selectedKey] ?? examples['hello-world'] ?? Object.values(examples)[0]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <span className="truncate">{selectedExample?.name ?? 'Hello World'}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder={i18n._(msg`搜索示例...`)} />
          <CommandEmpty>
            <Trans>未找到示例。</Trans>
          </CommandEmpty>
          <CommandGroup>
            <CommandList>
              {Object.entries(examples).map(([key, example]) => (
                <CommandItem
                  key={key}
                  value={example.name}
                  onSelect={() => {
                    setSelectedKey(key)
                    action(example.content)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedKey === key ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {example.name}
                </CommandItem>
              ))}
            </CommandList>
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
