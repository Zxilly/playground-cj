'use client'

import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getLocalizedExamples } from '@/const'
import { cn } from '@/lib/utils'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
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
  const [commandSession, setCommandSession] = useState(0)
  const commandInputRef = useRef<HTMLInputElement>(null)

  const examples = useMemo(() => getLocalizedExamples(locale), [locale])
  const selectedExample = examples[selectedKey] ?? examples['hello-world'] ?? Object.values(examples)[0]

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen)
      setCommandSession(current => current + 1)
    setOpen(nextOpen)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={i18n._(msg`选择示例`)}
          className="min-h-11 w-full justify-between lg:min-h-9"
        >
          <span className="truncate">{selectedExample?.name ?? 'Hello World'}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[300px] p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          requestAnimationFrame(() => commandInputRef.current?.focus())
        }}
      >
        <Command
          key={commandSession}
          label={i18n._(msg`搜索示例`)}
          defaultValue={selectedExample?.name ?? selectedKey}
        >
          <CommandInput
            ref={commandInputRef}
            placeholder={i18n._(msg`搜索示例...`)}
          />
          <CommandEmpty>
            <Trans>未找到示例。</Trans>
          </CommandEmpty>
          <CommandGroup>
            <CommandList>
              {Object.entries(examples).map(([key, example]) => (
                <CommandItem
                  key={key}
                  value={example.name}
                  className="min-h-11 lg:min-h-8"
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
