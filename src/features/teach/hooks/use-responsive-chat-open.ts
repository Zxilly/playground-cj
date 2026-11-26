'use client'

import { useState } from 'react'

export function useResponsiveChatOpen(
  compact: boolean,
  pendingPrefill: string | null,
  prefillRevision: number,
) {
  // Opening is an edge-triggered learner action. A retained draft must not
  // reopen the mobile sheet when the active learning path remounts the shell.
  const [chatOpen, setChatOpen] = useState(false)
  const [observed, setObserved] = useState({ compact, pendingPrefill, prefillRevision })
  if (
    observed.compact !== compact
    || observed.pendingPrefill !== pendingPrefill
    || observed.prefillRevision !== prefillRevision
  ) {
    const enteredCompact = compact && !observed.compact
    const receivedCompactPrefill = compact
      && pendingPrefill !== null
      && (
        observed.pendingPrefill !== pendingPrefill
        || observed.prefillRevision !== prefillRevision
        || !observed.compact
      )
    setObserved({ compact, pendingPrefill, prefillRevision })
    if (receivedCompactPrefill)
      setChatOpen(true)
    else if (enteredCompact)
      setChatOpen(false)
  }
  return [chatOpen, setChatOpen] as const
}
