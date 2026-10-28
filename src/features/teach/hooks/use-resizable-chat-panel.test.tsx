import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CHAT_MIN_WIDTH, useResizableChatPanel } from './use-resizable-chat-panel'

function ChatPanel() {
  const { chatRef, chatWidth, chatMaxWidth, startResize, onHandleKeyDown } = useResizableChatPanel()
  return (
    <section ref={chatRef} style={{ width: chatWidth }}>
      <div
        role="separator"
        tabIndex={0}
        aria-valuenow={chatWidth}
        aria-valuemin={CHAT_MIN_WIDTH}
        aria-valuemax={chatMaxWidth}
        onPointerDown={startResize}
        onKeyDown={onHandleKeyDown}
      />
    </section>
  )
}

beforeEach(() => {
  localStorage.removeItem('teach:chat-width')
  vi.stubGlobal('innerWidth', 1440)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.removeItem('teach:chat-width')
})

describe('useResizableChatPanel', () => {
  it('restores and persists the existing preference key within the desktop bounds', () => {
    localStorage.setItem('teach:chat-width', '504')
    render(<ChatPanel />)
    const handle = screen.getByRole('separator')
    expect(handle.getAttribute('aria-valuenow')).toBe('504')

    fireEvent.keyDown(handle, { key: 'ArrowLeft', shiftKey: true })
    expect(handle.getAttribute('aria-valuenow')).toBe('528')
    expect(localStorage.getItem('teach:chat-width')).toBe('528')
    fireEvent.keyDown(handle, { key: 'End' })
    expect(handle.getAttribute('aria-valuenow')).toBe('632')

    act(() => {
      vi.stubGlobal('innerWidth', 1280)
      window.dispatchEvent(new Event('resize'))
    })
    expect(handle.getAttribute('aria-valuemax')).toBe('472')
    expect(handle.getAttribute('aria-valuenow')).toBe('472')
    expect(localStorage.getItem('teach:chat-width')).toBe('472')
    fireEvent.keyDown(handle, { key: 'Home' })
    expect(handle.getAttribute('aria-valuenow')).toBe('320')
  })

  it('keeps resizing usable when preference storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage blocked')
    })
    render(<ChatPanel />)
    const handle = screen.getByRole('separator')
    expect(handle.getAttribute('aria-valuenow')).toBe('400')
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(handle.getAttribute('aria-valuenow')).toBe('376')
  })
})
