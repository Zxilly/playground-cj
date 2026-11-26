'use client'

import { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { useHydrated } from '@/hooks/useHydrated'

function subscribe(listener: () => void): () => void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined')
    return () => {}
  const observer = new MutationObserver(listener)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
  return () => observer.disconnect()
}

function snapshot(): boolean {
  return typeof document !== 'undefined'
    && document.documentElement.classList.contains('dark')
}

/**
 * Observe the single site-wide theme source (`next-themes` / root `html.dark`).
 * Returns `false` during SSR and initial hydration to avoid mismatches, then
 * stays in sync with explicit light/dark choices and system theme changes.
 */
export function useRootDarkMode(): boolean {
  const { resolvedTheme } = useTheme()
  const rootDark = useSyncExternalStore(subscribe, snapshot, () => false)
  const hydrated = useHydrated()

  if (hydrated && (resolvedTheme === 'dark' || resolvedTheme === 'light'))
    return resolvedTheme === 'dark'

  return rootDark
}
