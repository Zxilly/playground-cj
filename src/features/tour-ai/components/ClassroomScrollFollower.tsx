'use client'

import { ChevronDown } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'

interface Props {
  visible: boolean
  onClick: () => void
}

export function ClassroomScrollFollower({ visible, onClick }: Props) {
  if (!visible)
    return null
  return (
    <button
      type="button"
      aria-label={t`滚动到最新内容`}
      onClick={onClick}
      className="absolute bottom-6 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-tour-border bg-tour-surface px-3 py-1.5 text-xs font-medium text-tour-accent-fg shadow-md hover:bg-tour-bg"
    >
      <ChevronDown className="size-3.5" />
      <Trans>新内容</Trans>
    </button>
  )
}
