'use client'

import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getLocalizedExamples } from '@/const'
import { cn } from '@/lib/utils'
import { Check, ChevronsUpDown } from 'lucide-react'
import * as React from 'react'
import { Trans } from '@lingui/react/macro'
import { t } from '@lingui/core/macro'
import { i18n } from '@/lib/i18n'

interface ExamplesDropdownProps {
  action: (nextCode: string) => void
}

export function ExamplesDropdown({ action }: ExamplesDropdownProps) {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState<string>('Hello World')

  // Get localized examples based on current language
  const examples = React.useMemo(() => getLocalizedExamples(), [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <span className="truncate">{value}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder={i18n._(t`搜索示例...`)} />
          <CommandEmpty>
            <Trans>未找到示例。</Trans>
          </CommandEmpty>
          <CommandGroup>
            <CommandList>
              {Object.entries(examples).map(([name, content]) => (
                <CommandItem
                  key={name}
                  value={name}
                  onSelect={(currentValue) => {
                    setValue(currentValue)
                    action(content)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === name ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {name}
                </CommandItem>
              ))}
            </CommandList>
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
