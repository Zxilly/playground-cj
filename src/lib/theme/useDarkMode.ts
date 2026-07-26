import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-color-scheme: dark)'

export function useDarkMode(): boolean {
  return useSyncExternalStore(
    (callback) => {
      const mql = window.matchMedia(QUERY)
      mql.addEventListener('change', callback)
      return () => mql.removeEventListener('change', callback)
    },
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
}
