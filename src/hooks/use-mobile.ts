import * as React from 'react'

const MOBILE_BREAKPOINT = 768
// Reserve the modal chat drawer for phone-sized viewports. Tablet and laptop
// widths have enough room for chat to remain a secondary side column alongside
// the primary learning workspace.
const COMPACT_VIEWPORT_BREAKPOINT = MOBILE_BREAKPOINT

function subscribeAt(breakpoint: number, onStoreChange: () => void) {
  // `matchMedia` is absent in some non-browser environments (e.g. jsdom under
  // test); degrade to a no-op subscription so consumers fall back to the
  // desktop snapshot instead of throwing.
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
    return () => {}
  const mediaQuery = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
  mediaQuery.addEventListener('change', onStoreChange)
  return () => mediaQuery.removeEventListener('change', onStoreChange)
}

function getSnapshotAt(breakpoint: number) {
  if (typeof window === 'undefined')
    return false
  return window.innerWidth < breakpoint
}

const subscribeMobile = (onStoreChange: () => void) => subscribeAt(MOBILE_BREAKPOINT, onStoreChange)
const getMobileSnapshot = () => getSnapshotAt(MOBILE_BREAKPOINT)

const subscribeCompact = (onStoreChange: () => void) => subscribeAt(COMPACT_VIEWPORT_BREAKPOINT, onStoreChange)
const getCompactSnapshot = () => getSnapshotAt(COMPACT_VIEWPORT_BREAKPOINT)

export function useIsMobile() {
  return React.useSyncExternalStore(subscribeMobile, getMobileSnapshot, () => false)
}

/** True while the classroom should use its top-nav + chat-drawer layout. */
export function useIsCompactViewport() {
  return React.useSyncExternalStore(subscribeCompact, getCompactSnapshot, () => false)
}
