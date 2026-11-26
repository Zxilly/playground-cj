'use client'

import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { DeferredPopover } from './DeferredPopover'
import { ChevronsUpDown } from 'lucide-react'
import { useState } from 'react'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'

const ExamplesMenu = dynamic(() => import('./ExamplesMenu'))

export interface ExampleSelectionMeta {
  key: string
  name: string
}

interface ExamplesDropdownProps {
  action: (nextCode: string, meta?: ExampleSelectionMeta) => void
  disabled?: boolean
  /** Controlled example key; `null` indicates custom/draft/shared code. Omit for uncontrolled mode. */
  selectedKey?: string | null
  /** Controlled display label for the combobox button. */
  selectedLabel?: string | null
}

export function ExamplesDropdown({
  action,
  disabled,
  selectedKey,
  selectedLabel,
}: ExamplesDropdownProps) {
  const { i18n } = useLingui()
  const [open, setOpen] = useState(false)
  const [uncontrolled, setUncontrolled] = useState({ key: 'hello-world', name: 'Hello World' })

  const isControlled = selectedKey !== undefined
  const activeKey = isControlled ? (selectedKey ?? '') : uncontrolled.key
  const activeLabel = isControlled
    ? (selectedLabel || i18n._(msg`选择示例`))
    : uncontrolled.name

  return (
    <DeferredPopover
      open={open}
      onOpenChange={setOpen}
      className="w-[300px] p-0"
      preventOpenAutoFocus
      trigger={(
        <Button
          variant="outline"
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-label={i18n._(msg`选择示例`)}
          className="min-h-11 w-full justify-between lg:min-h-9"
        >
          <span className="truncate">{activeLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      )}
    >
      {open && (
        <ExamplesMenu
          selectedKey={activeKey}
          onSelect={(key, name, content) => {
            if (!isControlled)
              setUncontrolled({ key, name })
            action(content, { key, name })
            setOpen(false)
          }}
        />
      )}
    </DeferredPopover>
  )
}
