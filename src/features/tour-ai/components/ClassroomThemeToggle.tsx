'use client'

import { useId } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { useClassroomTheme } from '@/features/tour-ai/context/classroom-theme-context'
import type { ThemeMode } from '@/features/tour-ai/context/classroom-theme-context'

const NEXT_MODE: Record<ThemeMode, ThemeMode> = {
  auto: 'light',
  light: 'dark',
  dark: 'auto',
}

export function ClassroomThemeToggle() {
  const descriptionId = useId()
  const { mode, setMode } = useClassroomTheme()
  const Icon = mode === 'auto' ? Monitor : mode === 'light' ? Sun : Moon
  const nextMode = NEXT_MODE[mode]
  const label = mode === 'auto'
    ? t`主题：跟随系统`
    : mode === 'light'
      ? t`主题：浅色`
      : t`主题：深色`
  const nextLabel = nextMode === 'auto'
    ? t`跟随系统`
    : nextMode === 'light'
      ? t`浅色`
      : t`深色`
  const description = t`点击后切换到${nextLabel}主题。`
  return (
    <button
      type="button"
      aria-label={label}
      aria-describedby={descriptionId}
      title={description}
      onClick={() => setMode(nextMode)}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-tour-bg"
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span id={descriptionId} className="sr-only">{description}</span>
    </button>
  )
}
