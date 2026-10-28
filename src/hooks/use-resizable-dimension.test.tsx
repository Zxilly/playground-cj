import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useResizableDimension } from './use-resizable-dimension'

class TestPointerEvent extends MouseEvent {
  readonly pointerId: number
  constructor(type: string, options: PointerEventInit = {}) {
    super(type, options)
    this.pointerId = options.pointerId ?? 1
  }
}

function ResizablePanel({
  axis = 'vertical',
  anchor,
  onChange = () => {},
}: {
  axis?: 'horizontal' | 'vertical'
  anchor?: number
  onChange?: (value: number) => void
}) {
  const [value, setValue] = useState(176)
  const { startResize, onHandleKeyDown } = useResizableDimension({
    axis,
    value,
    onChange: (next) => {
      setValue((previous) => {
        const updated = typeof next === 'function' ? next(previous) : next
        onChange(updated)
        return updated
      })
    },
    clamp: next => Math.max(112, Math.min(480, next)),
    min: 112,
    getMax: () => 480,
    keyboardStep: 24,
    shiftMultiplier: 2,
    getDragAnchor: anchor === undefined ? undefined : () => anchor,
  })
  return (
    <div
      role="separator"
      tabIndex={0}
      aria-valuenow={value}
      onPointerDown={startResize}
      onKeyDown={onHandleKeyDown}
    />
  )
}

beforeEach(() => {
  vi.stubGlobal('PointerEvent', TestPointerEvent)
  document.body.style.cursor = 'auto'
  document.body.style.userSelect = 'text'
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
})

describe('useResizableDimension', () => {
  it('keeps directional keys, Shift increments and bounds on both axes', () => {
    const rendered = render(<ResizablePanel />)
    const handle = screen.getByRole('separator')
    fireEvent.keyDown(handle, { key: 'ArrowUp', shiftKey: true })
    expect(handle.getAttribute('aria-valuenow')).toBe('224')
    fireEvent.keyDown(handle, { key: 'ArrowDown' })
    expect(handle.getAttribute('aria-valuenow')).toBe('200')
    fireEvent.keyDown(handle, { key: 'Home' })
    fireEvent.keyDown(handle, { key: 'ArrowDown' })
    expect(handle.getAttribute('aria-valuenow')).toBe('112')
    fireEvent.keyDown(handle, { key: 'End' })
    fireEvent.keyDown(handle, { key: 'ArrowUp' })
    expect(handle.getAttribute('aria-valuenow')).toBe('480')

    rendered.rerender(<ResizablePanel axis="horizontal" />)
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(handle.getAttribute('aria-valuenow')).toBe('456')
    fireEvent.keyDown(handle, { key: 'ArrowLeft' })
    expect(handle.getAttribute('aria-valuenow')).toBe('480')
    expect(fireEvent.keyDown(handle, { key: 'PageDown' })).toBe(true)
  })

  it('resizes from the starting height, ignores other pointers, and restores styles on cancel', () => {
    render(<ResizablePanel />)
    const handle = screen.getByRole('separator')
    fireEvent.pointerDown(handle, { clientY: 500, pointerId: 7, button: 0 })
    expect(document.body.style.cursor).toBe('row-resize')
    expect(document.body.style.userSelect).toBe('none')
    fireEvent.pointerMove(window, { clientY: 400, pointerId: 9 })
    fireEvent.pointerCancel(window, { pointerId: 9 })
    expect(handle.getAttribute('aria-valuenow')).toBe('176')

    fireEvent.pointerMove(window, { clientY: 400, pointerId: 7 })
    expect(handle.getAttribute('aria-valuenow')).toBe('276')
    fireEvent.pointerMove(window, { clientY: 100, pointerId: 7 })
    expect(handle.getAttribute('aria-valuenow')).toBe('480')
    fireEvent.pointerCancel(window, { pointerId: 7 })
    expect(document.body.style.cursor).toBe('auto')
    expect(document.body.style.userSelect).toBe('text')
    fireEvent.pointerMove(window, { clientY: 600, pointerId: 7 })
    expect(handle.getAttribute('aria-valuenow')).toBe('480')
  })

  it('uses a fixed panel edge for horizontal dragging and ignores secondary clicks', () => {
    render(<ResizablePanel axis="horizontal" anchor={1000} />)
    const handle = screen.getByRole('separator')
    fireEvent.pointerDown(handle, { clientX: 800, button: 2 })
    fireEvent.pointerMove(window, { clientX: 600 })
    expect(handle.getAttribute('aria-valuenow')).toBe('176')
    expect(document.body.style.cursor).toBe('auto')

    fireEvent.pointerDown(handle, { clientX: 800, button: 0 })
    fireEvent.pointerMove(window, { clientX: 600 })
    expect(handle.getAttribute('aria-valuenow')).toBe('400')
    fireEvent.pointerUp(window)
    expect(document.body.style.cursor).toBe('auto')
    fireEvent.pointerMove(window, { clientX: 700 })
    expect(handle.getAttribute('aria-valuenow')).toBe('400')
  })

  it('cleans up captured pointers and window listeners when its panel unmounts', () => {
    const onChange = vi.fn()
    const rendered = render(<ResizablePanel onChange={onChange} />)
    const handle = screen.getByRole('separator')
    const capture = vi.fn()
    const release = vi.fn()
    Object.assign(handle, {
      setPointerCapture: capture,
      hasPointerCapture: () => true,
      releasePointerCapture: release,
    })
    fireEvent.pointerDown(handle, { clientY: 500, pointerId: 3, button: 0 })
    expect(capture).toHaveBeenCalledWith(3)
    rendered.unmount()
    expect(release).toHaveBeenCalledWith(3)
    expect(document.body.style.userSelect).toBe('text')
    expect(document.body.style.cursor).toBe('auto')
    fireEvent.pointerMove(window, { clientY: 400, pointerId: 3 })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('ends a drag when the browser loses focus', () => {
    render(<ResizablePanel />)
    const handle = screen.getByRole('separator')
    fireEvent.pointerDown(handle, { clientY: 500, button: 0 })
    fireEvent.blur(window)
    expect(document.body.style.cursor).toBe('auto')
    fireEvent.pointerMove(window, { clientY: 400 })
    expect(handle.getAttribute('aria-valuenow')).toBe('176')
  })
})
