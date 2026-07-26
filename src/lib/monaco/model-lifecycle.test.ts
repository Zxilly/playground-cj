import { describe, expect, it, vi } from 'vitest'
import { ModelLeaseRegistry } from './model-lifecycle'

function resource() {
  return { dispose: vi.fn(), isDisposed: () => false }
}

describe('modelLeaseRegistry', () => {
  it('keeps a shared model alive until its final lease is released', () => {
    const registry = new ModelLeaseRegistry<ReturnType<typeof resource>>()
    const model = resource()
    const first = registry.acquire('file:///same.cj', () => ({ resource: model, owned: true }))
    const second = registry.acquire('file:///same.cj', () => {
      throw new Error('must reuse the registered model')
    })

    expect(second.resource).toBe(model)
    first.release()
    expect(model.dispose).not.toHaveBeenCalled()
    second.release()
    expect(model.dispose).toHaveBeenCalledOnce()
  })

  it('retains scoped drafts across editor remounts and disposes them when the scope ends', () => {
    const registry = new ModelLeaseRegistry<ReturnType<typeof resource>>()
    const model = resource()
    const releaseScope = registry.retainScope('lesson:1')
    const first = registry.acquire(
      'file:///lesson-1/b0.cj',
      () => ({ resource: model, owned: true }),
      { scope: 'lesson:1', retainWhenUnused: true },
    )

    first.release()
    expect(model.dispose).not.toHaveBeenCalled()
    const remount = registry.acquire(
      'file:///lesson-1/b0.cj',
      () => {
        throw new Error('must reuse the retained draft')
      },
      { scope: 'lesson:1', retainWhenUnused: true },
    )
    expect(remount.resource).toBe(model)

    releaseScope()
    expect(model.dispose).not.toHaveBeenCalled()
    remount.release()
    expect(model.dispose).toHaveBeenCalledOnce()
  })

  it('does not dispose a model borrowed from outside the registry', () => {
    const registry = new ModelLeaseRegistry<ReturnType<typeof resource>>()
    const model = resource()
    const lease = registry.acquire('file:///borrowed.cj', () => ({ resource: model, owned: false }))
    lease.release()
    expect(model.dispose).not.toHaveBeenCalled()
  })
})
