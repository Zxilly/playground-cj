import { useSyncExternalStore } from 'react'

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
 * Observe the actual root theme class rather than guessing from the OS media
 * query. This keeps asynchronously highlighted code aligned with an explicit
 * light/dark preference as well as with automatic theme changes.
 */
export function useRootDarkMode(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false)
}
