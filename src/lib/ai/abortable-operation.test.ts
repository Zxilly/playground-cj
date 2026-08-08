import { describe, expect, it, vi } from 'vitest'
import { awaitWithSignal } from './abortable-operation'

describe('awaitWithSignal', () => {
  it('observes an already-started operation when the signal is already aborted', async () => {
    const lateFailure = new Error('late failure')
    const observed = vi.fn()
    const operation: PromiseLike<never> = {
      then<TResult1 = never, TResult2 = never>(
        onfulfilled?: ((value: never) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ): PromiseLike<TResult1 | TResult2> {
        observed()
        return Promise.reject(lateFailure).then(onfulfilled, onrejected)
      },
    }
    const controller = new AbortController()
    controller.abort(new DOMException('deadline', 'TimeoutError'))

    await expect(
      awaitWithSignal(operation, controller.signal),
    ).rejects.toMatchObject({ name: 'TimeoutError' })
    await Promise.resolve()

    expect(observed).toHaveBeenCalledOnce()
  })
})
