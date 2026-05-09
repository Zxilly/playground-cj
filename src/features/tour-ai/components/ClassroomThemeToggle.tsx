'use client'

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
  const { mode, setMode } = useClassroomTheme()
  const Icon = mode === 'auto' ? Monitor : mode === 'light' ? Sun : Moon
  const label = mode === 'auto'
    ? t`主题：跟随系统`
    : mode === 'light'
      ? t`主题：浅色`
      : t`主题：深色`
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => setMode(NEXT_MODE[mode])}
      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-tour-bg"
    >
      <Icon className="size-4" />
    </button>
  )
}
