'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'

const CHAT_WIDTH_KEY = 'teach:chat-width'
export const CHAT_MIN_WIDTH = 320
export const CHAT_MAX_WIDTH = 640
export const CHAT_DEFAULT_WIDTH = 400
const CHAT_KEYBOARD_STEP = 24
const SIDEBAR_WIDTH = 208
const CENTER_MIN_WIDTH = 480

function effectiveMaxWidth(): number {
  if (typeof window === 'undefined')
    return CHAT_MAX_WIDTH
  return Math.max(
    CHAT_MIN_WIDTH,
    Math.min(CHAT_MAX_WIDTH, window.innerWidth - SIDEBAR_WIDTH - CENTER_MIN_WIDTH),
  )
}

function clampChatWidth(px: number): number {
  return Math.min(effectiveMaxWidth(), Math.max(CHAT_MIN_WIDTH, Math.round(px)))
}

/** Owns desktop chat sizing, keyboard resizing, persistence, and drag cleanup. */
export function useResizableChatPanel() {
  const chatRef = useRef<HTMLElement>(null)
  const cleanupDragRef = useRef<() => void>(() => {})
  const persistArmedRef = useRef(false)
  const [chatWidth, setChatWidth] = useState(CHAT_DEFAULT_WIDTH)
  const [chatMaxWidth, setChatMaxWidth] = useState(() => effectiveMaxWidth())

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(CHAT_WIDTH_KEY))
      if (Number.isFinite(saved) && saved > 0) {
        // eslint-disable-next-line react/set-state-in-effect -- one-time restoration of an external preference
        setChatWidth(clampChatWidth(saved))
      }
    }
    catch {
      // A blocked storage API should not prevent the workspace from opening.
    }
  }, [])

  useEffect(() => {
    if (!persistArmedRef.current) {
      persistArmedRef.current = true
      return
    }
    try {
      localStorage.setItem(CHAT_WIDTH_KEY, String(chatWidth))
    }
    catch {
      // Keep the in-memory width when the preference cannot be persisted.
    }
  }, [chatWidth])

  useEffect(() => {
    const onResize = () => {
      setChatMaxWidth(effectiveMaxWidth())
      setChatWidth(width => clampChatWidth(width))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => () => cleanupDragRef.current(), [])

  const startResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    cleanupDragRef.current()
    const rightEdge = chatRef.current?.getBoundingClientRect().right ?? window.innerWidth
    const previousUserSelect = document.body.style.userSelect
    const previousCursor = document.body.style.cursor

    const onMove = (moveEvent: PointerEvent) => {
      setChatWidth(clampChatWidth(rightEdge - moveEvent.clientX))
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', cleanup)
      window.removeEventListener('pointercancel', cleanup)
      document.body.style.userSelect = previousUserSelect
      document.body.style.cursor = previousCursor
      cleanupDragRef.current = () => {}
    }

    cleanupDragRef.current = cleanup
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', cleanup)
    window.addEventListener('pointercancel', cleanup)
  }, [])

  const onHandleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setChatWidth(width => clampChatWidth(width + CHAT_KEYBOARD_STEP))
    }
    else if (event.key === 'ArrowRight') {
      event.preventDefault()
      setChatWidth(width => clampChatWidth(width - CHAT_KEYBOARD_STEP))
    }
    else if (event.key === 'Home') {
      event.preventDefault()
      setChatWidth(CHAT_MIN_WIDTH)
    }
    else if (event.key === 'End') {
      event.preventDefault()
      setChatWidth(effectiveMaxWidth())
    }
  }, [])

  return {
    chatRef,
    chatMaxWidth,
    chatWidth,
    onHandleKeyDown,
    startResize,
  }
}
