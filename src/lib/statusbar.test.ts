import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCustomStatusBar } from './statusbar'

describe('createCustomStatusBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses a touch-safe compact height and follows viewport changes', async () => {
    let compact = true
    let onViewportChange: (() => void) | undefined
    const removeEventListener = vi.fn()
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      get matches() {
        return compact
      },
      addEventListener: vi.fn((_event: string, listener: () => void) => {
        onViewportChange = listener
      }),
      removeEventListener,
    })))
    const parent = document.createElement('div')
    document.body.appendChild(parent)

    const statusBar = await createCustomStatusBar(parent, {
      height: 22,
      compactHeight: 44,
    })
    expect(statusBar.container.style.height).toBe('44px')

    compact = false
    onViewportChange?.()
    expect(statusBar.container.style.height).toBe('22px')

    statusBar.dispose()
    expect(removeEventListener).toHaveBeenCalledWith('change', onViewportChange)
    expect(parent.querySelector('.statusbar-container')).toBeNull()
    parent.remove()
  })
})
