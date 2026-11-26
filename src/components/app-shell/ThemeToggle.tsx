'use client'

import type { ComponentPropsWithoutRef } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Trans, useLingui } from '@lingui/react/macro'
import { Button } from '@/components/ui/button'
import { useHydrated } from '@/hooks/useHydrated'
import { cn } from '@/lib/utils'

export type ThemeMode = 'system' | 'light' | 'dark'

export interface ThemeToggleProps extends Omit<ComponentPropsWithoutRef<'button'>, 'onClick' | 'children'> {
  /** Render the current theme mode text next to the icon. */
  showLabel?: boolean
  /** Visual style forwarded to the underlying Button. */
  variant?: 'ghost' | 'outline'
}

function normalizeThemeMode(theme: string | undefined): ThemeMode {
  if (theme === 'light' || theme === 'dark' || theme === 'system')
    return theme
  return 'system'
}

function nextThemeMode(current: ThemeMode, systemTheme: string | undefined): ThemeMode {
  // Always produce an immediate visual switch when leaving 'system',
  // while keeping all three states reachable in one 3-step cycle.
  if (systemTheme === 'dark') {
    if (current === 'system')
      return 'light'
    if (current === 'light')
      return 'dark'
    return 'system'
  }

  if (current === 'system')
    return 'dark'
  if (current === 'dark')
    return 'light'
  return 'system'
}

export function ThemeToggle({
  showLabel = false,
  variant = 'ghost',
  className,
  ...props
}: ThemeToggleProps) {
  const { theme, systemTheme, setTheme } = useTheme()
  const hydrated = useHydrated()
  const { t } = useLingui()

  const currentMode: ThemeMode = hydrated ? normalizeThemeMode(theme) : 'system'

  const label = currentMode === 'light'
    ? t`切换主题（当前：浅色）`
    : currentMode === 'dark'
      ? t`切换主题（当前：深色）`
      : t`切换主题（当前：跟随系统）`

  const handleToggle = () => {
    setTheme(nextThemeMode(currentMode, systemTheme))
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={showLabel ? 'sm' : 'icon'}
      data-theme-mode={currentMode}
      aria-label={label}
      title={label}
      onClick={handleToggle}
      className={cn(
        showLabel
          ? 'min-h-11 gap-1.5 px-2.5 lg:min-h-9'
          : 'size-11 lg:size-9',
        className,
      )}
      {...props}
    >
      {currentMode === 'light' && <Sun aria-hidden="true" className="size-4" />}
      {currentMode === 'dark' && <Moon aria-hidden="true" className="size-4" />}
      {currentMode === 'system' && <Monitor aria-hidden="true" className="size-4" />}
      {showLabel && (
        <span>
          {currentMode === 'light'
            ? <Trans>浅色</Trans>
            : currentMode === 'dark'
              ? <Trans>深色</Trans>
              : <Trans>系统</Trans>}
        </span>
      )}
    </Button>
  )
}
