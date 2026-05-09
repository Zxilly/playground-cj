'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

const PIN_THRESHOLD_PX = 96

interface UseScrollFollowerArgs {
  viewportRef: RefObject<HTMLDivElement | null>
  contentLength: number
  hydrated: boolean
}

interface ScrollFollowerState {
  pinned: boolean
  newContentBelow: boolean
  scrollToBottom: () => void
}

export function useScrollFollower({ viewportRef, contentLength, hydrated }: UseScrollFollowerArgs): ScrollFollowerState {
  const [pinned, setPinned] = useState(true)
  const [newContentBelow, setNewContentBelow] = useState(false)
  const lastLengthRef = useRef<number | null>(null)

  useEffect(() => {
    const el = viewportRef.current
    if (!el)
      return
    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      const nextPinned = distFromBottom <= PIN_THRESHOLD_PX
      setPinned(nextPinned)
      if (nextPinned)
        setNewContentBelow(false)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [viewportRef])

  useEffect(() => {
    if (!hydrated)
      return
    const el = viewportRef.current
    if (!el)
      return
    const previous = lastLengthRef.current
    lastLengthRef.current = contentLength
    if (previous === null) {
      // Initial sync after hydration — do not modify scroll position; the
      // caller is responsible for the initial bottom-pin (e.g. via a one-shot
      // imperative scroll on session restore).
      return
    }
    if (contentLength > previous) {
      if (pinned) {
        el.scrollTop = el.scrollHeight
      }
      else {
        setNewContentBelow(true)
      }
    }
  }, [contentLength, hydrated, pinned, viewportRef])

  const scrollToBottom = useCallback(() => {
    const el = viewportRef.current
    if (!el)
      return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [viewportRef])

  return { pinned, newContentBelow, scrollToBottom }
}
