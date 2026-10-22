'use client'

import { useEffect } from 'react'
import type { ReactNode } from 'react'

interface HighlightProps {
  target: string
  children: ReactNode
}

export function Highlight({ target, children }: HighlightProps) {
  useEffect(() => {
    let el: Element | null = null
    let observer: MutationObserver | undefined
    let pulseTimer: ReturnType<typeof setTimeout> | undefined
    let waitTimer: ReturnType<typeof setTimeout> | undefined

    const stopWaiting = () => {
      observer?.disconnect()
      clearTimeout(waitTimer)
    }

    const highlightTarget = () => {
      el = document.querySelector(`[data-tour-highlight="${target}"]`)
      if (!el)
        return false

      stopWaiting()
      el.classList.add('tour-highlight-pulse')
      pulseTimer = setTimeout(() => {
        el?.classList.remove('tour-highlight-pulse')
      }, 3000)
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
      clearTimeout(pulseTimer)
      el?.classList.remove('tour-highlight-pulse')
    }
  }, [target])

  return (
    <span
      className="font-semibold text-tour-accent-fg cursor-help border-b border-dashed border-tour-accent-fg/50"
      onMouseEnter={() => {
        const el = document.querySelector(`[data-tour-highlight="${target}"]`)
        el?.classList.add('tour-highlight-pulse')
      }}
      onMouseLeave={() => {
        const el = document.querySelector(`[data-tour-highlight="${target}"]`)
        el?.classList.remove('tour-highlight-pulse')
      }}
    >
      {children}
    </span>
  )
}
