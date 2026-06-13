import { describe, expect, it } from 'vitest'
import type { ActiveEditorHandle } from './active-editor-store'
import { createActiveEditorRegistry } from './active-editor-store'

/** A fake code_task editor handle backed by a plain string. */
function fakeHandle(initial = ''): ActiveEditorHandle & { code: string } {
  const state = { code: initial }
  return {
    get code() {
      return state.code
    },
    set code(next: string) {
      state.code = next
    },
    getCode: () => state.code,
    setCode: (next: string) => {
      state.code = next
    },
  }
}

describe('createActiveEditorRegistry', () => {
  it('returns null code and refuses writes when no editor is active', () => {
    const registry = createActiveEditorRegistry()
    expect(registry.getCode()).toBeNull()
    expect(registry.setCode('let x = 1')).toBe(false)
  })

  it('reads the registered editor and writes through to it', () => {
    const registry = createActiveEditorRegistry()
    const handle = fakeHandle('main() {}')
    registry.register(handle)

    expect(registry.getCode()).toBe('main() {}')
    expect(registry.setCode('let x = 1')).toBe(true)
    expect(handle.code).toBe('let x = 1')
    expect(registry.getCode()).toBe('let x = 1')
  })

  it('the latest registered editor wins (focus moves between code_tasks)', () => {
    const registry = createActiveEditorRegistry()
    const first = fakeHandle('first')
    const second = fakeHandle('second')
    registry.register(first)
    registry.register(second)

    expect(registry.getCode()).toBe('second')
    registry.setCode('written')
    expect(second.code).toBe('written')
    expect(first.code).toBe('first')
  })

  it('unregister clears the active handle so reads fall back to null', () => {
    const registry = createActiveEditorRegistry()
    const handle = fakeHandle('code')
    const unregister = registry.register(handle)

    unregister()
    expect(registry.getCode()).toBeNull()
    expect(registry.setCode('x')).toBe(false)
  })

  it('a stale editor unmounting does not clear a newer active editor', () => {
    const registry = createActiveEditorRegistry()
    const first = fakeHandle('first')
    const second = fakeHandle('second')
    const unregisterFirst = registry.register(first)
    registry.register(second)

    // The first code_task unmounts after the second already took over: its
    // cleanup must NOT clobber the newer active editor.
    unregisterFirst()
    expect(registry.getCode()).toBe('second')
  })
})
