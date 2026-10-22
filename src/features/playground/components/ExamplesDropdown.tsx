'use client'

import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ChevronsUpDown } from 'lucide-react'
import { useState } from 'react'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'

const ExamplesMenu = dynamic(() => import('./ExamplesMenu'))

interface ExamplesDropdownProps {
  action: (nextCode: string) => void
  disabled?: boolean
}

export function ExamplesDropdown({ action, disabled }: ExamplesDropdownProps) {
  const { i18n } = useLingui()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState({ key: 'hello-world', name: 'Hello World' })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-label={i18n._(msg`选择示例`)}
          className="min-h-11 w-full justify-between lg:min-h-9"
        >
          <span className="truncate">{selected.name}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" onOpenAutoFocus={event => event.preventDefault()}>
        {open && (
          <ExamplesMenu
            selectedKey={selected.key}
            onSelect={(key, name, content) => {
              setSelected({ key, name })
              action(content)
              setOpen(false)
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  )
}
