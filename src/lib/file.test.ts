import { saveAsFile } from '@/lib/file'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('saveAsFile', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('creates a text blob, dispatches a download click, and revokes the object URL', async () => {
    vi.stubGlobal('MouseEvent', class extends window.MouseEvent {
      constructor(type: string, init?: MouseEventInit) {
        const { view: _view, ...safeInit } = init ?? {}
        super(type, safeInit)
      }
    })
    const url = 'blob:playground-cj'
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue(url)
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const dispatchEvent = vi.spyOn(HTMLAnchorElement.prototype, 'dispatchEvent').mockImplementation(() => true)

    saveAsFile('println("hi")', 'hello.cj')

    const blob = createObjectURL.mock.calls[0]?.[0] as Blob
    expect(await blob.text()).toBe('println("hi")')
    expect(blob.type).toBe('text/plain;charset=utf-8')

    const anchor = dispatchEvent.mock.instances[0] as HTMLAnchorElement
    const event = dispatchEvent.mock.calls[0]?.[0] as MouseEvent
    expect(anchor.href).toBe(url)
    expect(anchor.download).toBe('hello.cj')
    expect(event.type).toBe('click')
    expect(event.bubbles).toBe(true)
    expect(event.cancelable).toBe(true)
    expect(revokeObjectURL).toHaveBeenCalledWith(url)
  })

  it('uses main.cj as the default file name', () => {
    vi.stubGlobal('MouseEvent', class extends window.MouseEvent {
      constructor(type: string, init?: MouseEventInit) {
        const { view: _view, ...safeInit } = init ?? {}
        super(type, safeInit)
      }
    })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:default')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const dispatchEvent = vi.spyOn(HTMLAnchorElement.prototype, 'dispatchEvent').mockImplementation(() => true)

    saveAsFile('content')

    const anchor = dispatchEvent.mock.instances[0] as HTMLAnchorElement
    expect(anchor.download).toBe('main.cj')
  })
})
