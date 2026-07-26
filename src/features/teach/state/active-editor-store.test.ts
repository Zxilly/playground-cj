import { describe, expect, it } from 'vitest'
import { createActiveEditorRegistry } from './active-editor-store'

function fakeHandle(code: string) {
  return { getCode: () => code }
}

describe('createActiveEditorRegistry', () => {
  it('returns null when no editor is active', () => {
    const registry = createActiveEditorRegistry()
    expect(registry.getCode()).toBeNull()
  })

  it('reads the registered editor without exposing a write capability', () => {
    const registry = createActiveEditorRegistry()
    const handle = fakeHandle('main() {}')
    registry.register(handle)

    expect(registry.getCode()).toBe('main() {}')
    expect('setCode' in registry).toBe(false)
  })

  it('the latest registered editor wins when focus moves', () => {
    const registry = createActiveEditorRegistry()
    const first = fakeHandle('first')
    const second = fakeHandle('second')
    registry.register(first)
    registry.register(second)

    expect(registry.getCode()).toBe('second')
  })

  it('unregister clears the active handle so reads fall back to null', () => {
    const registry = createActiveEditorRegistry()
    const handle = fakeHandle('code')
    const unregister = registry.register(handle)

    unregister()
    expect(registry.getCode()).toBeNull()
  })

  it('a stale editor unmounting does not clear a newer active editor', () => {
    const registry = createActiveEditorRegistry()
    const first = fakeHandle('first')
    const second = fakeHandle('second')
    const unregisterFirst = registry.register(first)
    registry.register(second)

    // The first editor unmounts after the second already took over: its
    // cleanup must NOT clobber the newer active editor.
    unregisterFirst()
    expect(registry.getCode()).toBe('second')
  })
})
