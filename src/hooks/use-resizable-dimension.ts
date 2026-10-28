'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { Dispatch, KeyboardEvent, PointerEvent as ReactPointerEvent, SetStateAction } from 'react'

interface ResizableDimensionOptions {
  axis: 'horizontal' | 'vertical'
  value: number
  onChange: Dispatch<SetStateAction<number>>
  clamp: (value: number) => number
  min: number
  getMax: () => number
  keyboardStep: number
  shiftMultiplier?: number
  getDragAnchor?: () => number
}

/** Shared input handling; each surface retains its size, bounds and persistence. */
export function useResizableDimension({
  axis,
  value,
  onChange,
  clamp,
  min,
  getMax,
  keyboardStep,
  shiftMultiplier = 1,
  getDragAnchor,
}: ResizableDimensionOptions) {
  const cleanupDragRef = useRef<() => void>(() => {})
  useEffect(() => () => cleanupDragRef.current(), [])

  const startResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0)
      return
    event.preventDefault()
    cleanupDragRef.current()
    const handle = event.currentTarget
    const pointerId = event.pointerId
    const coordinate = axis === 'horizontal' ? event.clientX : event.clientY
    const anchor = getDragAnchor?.() ?? value + coordinate
    const previousUserSelect = document.body.style.userSelect
    const previousCursor = document.body.style.cursor

    const onMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId)
        return
      const position = axis === 'horizontal' ? moveEvent.clientX : moveEvent.clientY
      onChange(clamp(anchor - position))
    }
    const onEnd = (endEvent: PointerEvent) => {
      if (endEvent.pointerId === pointerId)
        cleanupDragRef.current()
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onEnd)
      window.removeEventListener('pointercancel', onEnd)
      window.removeEventListener('blur', cleanup)
      handle.removeEventListener('lostpointercapture', onEnd)
      document.body.style.userSelect = previousUserSelect
      document.body.style.cursor = previousCursor
      cleanupDragRef.current = () => {}
      if (handle.hasPointerCapture?.(pointerId))
        handle.releasePointerCapture(pointerId)
    }

    cleanupDragRef.current = cleanup
    document.body.style.userSelect = 'none'
    document.body.style.cursor = axis === 'horizontal' ? 'col-resize' : 'row-resize'
    handle.setPointerCapture?.(pointerId)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onEnd)
    window.addEventListener('pointercancel', onEnd)
    window.addEventListener('blur', cleanup)
    handle.addEventListener('lostpointercapture', onEnd)
  }, [axis, clamp, getDragAnchor, onChange, value])

  const onHandleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const step = keyboardStep * (event.shiftKey ? shiftMultiplier : 1)
    const increaseKey = axis === 'horizontal' ? 'ArrowLeft' : 'ArrowUp'
    const decreaseKey = axis === 'horizontal' ? 'ArrowRight' : 'ArrowDown'
    if (event.key === increaseKey)
      onChange(current => clamp(current + step))
    else if (event.key === decreaseKey)
      onChange(current => clamp(current - step))
    else if (event.key === 'Home')
      onChange(clamp(min))
    else if (event.key === 'End')
      onChange(clamp(getMax()))
    else
      return
    event.preventDefault()
  }, [axis, clamp, getMax, keyboardStep, min, onChange, shiftMultiplier])

  return { startResize, onHandleKeyDown }
}
