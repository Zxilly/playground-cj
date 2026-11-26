'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

interface HighlightProps {
  target: string
  children: ReactNode
}

const PULSE_DURATION_MS = 3000

export function Highlight({ target, children }: HighlightProps) {
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const lastTargetRef = useRef<Element | null>(null)

  const addHighlight = useCallback(() => {
    const el = document.querySelector(`[data-tour-highlight="${target}"]`)
    if (!el)
      return null
    lastTargetRef.current = el
    el.classList.add('tour-highlight-pulse')
    return el
  }, [target])

  const removeHighlight = useCallback(() => {
    if (pulseTimerRef.current !== undefined) {
      clearTimeout(pulseTimerRef.current)
      pulseTimerRef.current = undefined
    }
    lastTargetRef.current?.classList.remove('tour-highlight-pulse')
    const el = document.querySelector(`[data-tour-highlight="${target}"]`)
    el?.classList.remove('tour-highlight-pulse')
  }, [target])

  const triggerPulse = useCallback(() => {
    const el = addHighlight()
    if (!el)
      return false
    if (pulseTimerRef.current !== undefined)
      clearTimeout(pulseTimerRef.current)
    pulseTimerRef.current = setTimeout(() => {
      pulseTimerRef.current = undefined
      el.classList.remove('tour-highlight-pulse')
    }, PULSE_DURATION_MS)
    return true
  }, [addHighlight])

  useEffect(() => {
    let observer: MutationObserver | undefined
    let waitTimer: ReturnType<typeof setTimeout> | undefined

    const stopWaiting = () => {
      observer?.disconnect()
      clearTimeout(waitTimer)
    }

    const highlightTarget = () => {
      if (!triggerPulse())
        return false
      stopWaiting()
      return true
    }

    if (!highlightTarget()) {
      // The lesson can render before its editor chunk. Observe only until the
      // target mounts, with a bound for missing targets or failed chunk loads.
      observer = new MutationObserver(highlightTarget)
      observer.observe(document.body, { childList: true, subtree: true })
      waitTimer = setTimeout(stopWaiting, 60_000)
    }

    return () => {
      stopWaiting()
      removeHighlight()
    }
  }, [removeHighlight, triggerPulse])

  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      triggerPulse()
    }
  }

  return (
    <span
      role="button"
      tabIndex={0}
      className="cursor-pointer rounded-xs border-b border-dashed border-tour-accent-fg/50 font-semibold text-tour-accent-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tour-accent-fg"
      onMouseEnter={addHighlight}
      onMouseLeave={removeHighlight}
      onFocus={addHighlight}
      onBlur={removeHighlight}
      onClick={() => triggerPulse()}
      onKeyDown={handleKeyDown}
    >
      {children}
    </span>
  )
}
