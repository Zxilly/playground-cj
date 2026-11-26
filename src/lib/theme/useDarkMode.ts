'use client'

import { useRootDarkMode } from './useRootDarkMode'

/**
 * Unified dark mode hook backed by `next-themes` and root `html.dark`.
 * Kept as a backwards-compatible alias of `useRootDarkMode`.
 */
export function useDarkMode(): boolean {
  return useRootDarkMode()
}
