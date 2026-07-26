import { eventEmitter, EVENTS } from '@/lib/events'
import { describe, expect, it, vi } from 'vitest'

describe('eventEmitter', () => {
  it('notifies all listeners for an event with the emitted payload', () => {
    const first = vi.fn()
    const second = vi.fn()

    eventEmitter.on(EVENTS.RUN_CODE, first)
    eventEmitter.on(EVENTS.RUN_CODE, second)

    eventEmitter.emit(EVENTS.RUN_CODE, 'main()')

    expect(first).toHaveBeenCalledWith('main()')
    expect(second).toHaveBeenCalledWith('main()')

    eventEmitter.off(EVENTS.RUN_CODE, first)
    eventEmitter.off(EVENTS.RUN_CODE, second)
  })

  it('removes only the specified listener and ignores unknown removals', () => {
    const removed = vi.fn()
    const retained = vi.fn()

    eventEmitter.off(EVENTS.FORMAT_CODE, removed)
    eventEmitter.on(EVENTS.FORMAT_CODE, removed)
    eventEmitter.on(EVENTS.FORMAT_CODE, retained)
    eventEmitter.off(EVENTS.FORMAT_CODE, removed)

    eventEmitter.emit(EVENTS.FORMAT_CODE, 'source')

    expect(removed).not.toHaveBeenCalled()
    expect(retained).toHaveBeenCalledWith('source')

    eventEmitter.off(EVENTS.FORMAT_CODE, retained)
  })
})
