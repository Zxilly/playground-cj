import * as React from 'react'

const MOBILE_BREAKPOINT = 768

function subscribe(onStoreChange: () => void) {
  // `matchMedia` is absent in some non-browser environments (e.g. jsdom under
  // test); degrade to a no-op subscription so consumers fall back to the
  // desktop snapshot instead of throwing.
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
    return () => {}
  const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mediaQuery.addEventListener('change', onStoreChange)
  return () => mediaQuery.removeEventListener('change', onStoreChange)
}

function getSnapshot() {
  if (typeof window === 'undefined')
    return false
  return window.innerWidth < MOBILE_BREAKPOINT
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, () => false)
}
