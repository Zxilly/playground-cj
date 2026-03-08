'use client'

import { useEffect } from 'react'
import type { ReactNode } from 'react'

interface HighlightProps {
  target: string
  children: ReactNode
}

export function Highlight({ target, children }: HighlightProps) {
  useEffect(() => {
    const el = document.querySelector(`[data-tour-highlight="${target}"]`)
    if (!el)
      return

    el.classList.add('tour-highlight-pulse')
    const timer = setTimeout(() => {
      el.classList.remove('tour-highlight-pulse')
    }, 3000)

    return () => {
      clearTimeout(timer)
      el.classList.remove('tour-highlight-pulse')
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
