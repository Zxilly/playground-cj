'use client'

import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { EXAMPLES } from '@/const'
import { cn } from '@/lib/utils'
import { Check, ChevronsUpDown } from 'lucide-react'
import * as React from 'react'

type EXAMPLE_KEY = keyof typeof EXAMPLES

interface ExamplesDropdownProps {
  action: (nextCode: string) => void
}

export function ExamplesDropdown({ action }: ExamplesDropdownProps) {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState<EXAMPLE_KEY>('hello-world')

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="搜索示例..." />
          <CommandEmpty>未找到语言。</CommandEmpty>
          <CommandGroup>
            <CommandList>
              {Object.entries(EXAMPLES).map(ex => (
                <CommandItem
                  key={ex[0]}
                  value={ex[0]}
                  onSelect={(currentValue) => {
                    setValue(currentValue as EXAMPLE_KEY)
                    action(EXAMPLES[currentValue as EXAMPLE_KEY])
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === ex[0] ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {ex[0]}
                </CommandItem>
              ))}
            </CommandList>
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
