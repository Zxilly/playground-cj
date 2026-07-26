import { describe, expect, it } from 'vitest'
import { createPlaygroundWorkspaceLifecycle } from './playground-workspace-lifecycle'

describe('playground workspace lifecycle', () => {
  it('allows opening, recovery, and disposal only through declared transitions', () => {
    const lifecycle = createPlaygroundWorkspaceLifecycle()

    expect(lifecycle.snapshot()).toMatchObject({
      value: 'dormant',
      context: { publicStatus: 'closed' },
    })

    lifecycle.send({ type: 'open' })
    expect(lifecycle.snapshot()).toMatchObject({
      value: 'opening',
      context: { publicStatus: 'opening' },
    })

    lifecycle.send({ type: 'open.failed' })
    expect(lifecycle.snapshot()).toMatchObject({
      value: 'error',
      context: { publicStatus: 'error' },
    })

    lifecycle.send({ type: 'retry' })
    lifecycle.send({ type: 'open.succeeded' })
    expect(lifecycle.snapshot()).toMatchObject({
      value: 'ready',
      context: { publicStatus: 'ready' },
    })

    lifecycle.send({ type: 'close.started' })
    expect(lifecycle.snapshot().value).toBe('closing')
    lifecycle.send({ type: 'close.succeeded' })
    expect(lifecycle.snapshot()).toMatchObject({
      value: 'disposed',
      context: { publicStatus: 'closed' },
    })

    lifecycle.send({ type: 'retry' })
    expect(lifecycle.snapshot().value).toBe('disposed')
    lifecycle.stop()
  })

  it('restores a usable workspace when close cannot drain local work', () => {
    const lifecycle = createPlaygroundWorkspaceLifecycle()
    lifecycle.send({ type: 'open' })
    lifecycle.send({ type: 'open.succeeded' })
    lifecycle.send({ type: 'close.started' })
    lifecycle.send({ type: 'close.rejected' })

    expect(lifecycle.snapshot()).toMatchObject({
      value: 'ready',
      context: { publicStatus: 'ready' },
    })
    lifecycle.stop()
  })

  it('restores the pre-close status when storage close itself fails', () => {
    const lifecycle = createPlaygroundWorkspaceLifecycle()
    lifecycle.send({ type: 'close.started' })
    lifecycle.send({ type: 'close.rejected' })

    expect(lifecycle.snapshot()).toMatchObject({
      value: 'dormant',
      context: { publicStatus: 'closed' },
    })
    lifecycle.stop()
  })
})
