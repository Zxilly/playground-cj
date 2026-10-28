import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCodeRunner } from './useCodeRunner'
import { isBusy } from '@/lib/lock'

const mocks = vi.hoisted(() => ({
  remoteRun: vi.fn(),
  format: vi.fn(),
  loading: vi.fn(() => 'notification'),
  success: vi.fn(),
  error: vi.fn(),
  dismiss: vi.fn(),
}))

vi.mock('@/service/run', () => ({ remoteRun: mocks.remoteRun }))
vi.mock('@/lib/cangjie-formatter', () => ({ browserCangjieFormatter: { format: mocks.format } }))
vi.mock('@lingui/react', () => ({
  useLingui: () => ({ i18n: { _: ({ message }: { message: string }) => message } }),
}))
vi.mock('sonner', () => ({ toast: mocks }))

function mountRunner() {
  const outputs = { setToolOutput: vi.fn(), setProgramOutput: vi.fn(), setTruncation: vi.fn(), setResult: vi.fn() }
  const onRunningChange = vi.fn()
  return { ...renderHook(() => useCodeRunner({ outputs, onRunningChange })), outputs, onRunningChange }
}

describe('instance-owned editor commands', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('reports only the accepted run lifecycle and rejects concurrent commands', async () => {
    let finish!: () => void
    mocks.remoteRun.mockImplementation(() => new Promise<void>((resolve) => {
      finish = resolve
    }))
    const { result, outputs, onRunningChange } = mountRunner()
    const pending = result.current.run('main() {}')
    try {
      expect(onRunningChange.mock.calls).toEqual([[true]])
      expect(isBusy()).toBe(true)
      expect(mocks.remoteRun).toHaveBeenCalledWith('main() {}', outputs, expect.any(AbortSignal))
      await result.current.run('ignored while busy')
      expect(mocks.remoteRun).toHaveBeenCalledTimes(1)
    }
    finally {
      finish()
      await pending
    }
    expect(onRunningChange.mock.calls).toEqual([[true], [false]])
    expect(isBusy()).toBe(false)
  })

  it('releases running and preserves the failure for an awaiting caller', async () => {
    const failure = new Error('compile failed')
    mocks.remoteRun.mockRejectedValue(failure)
    const { result, onRunningChange } = mountRunner()
    await expect(result.current.run('invalid code')).rejects.toBe(failure)
    expect(onRunningChange.mock.calls).toEqual([[true], [false]])
    expect(mocks.error).toHaveBeenCalledOnce()
    expect(isBusy()).toBe(false)
  })

  it('keeps output ownership separate when two editors are mounted', async () => {
    mocks.remoteRun.mockResolvedValue(undefined)
    const first = mountRunner()
    const second = mountRunner()
    await first.result.current.run('first')
    expect(mocks.remoteRun).toHaveBeenLastCalledWith('first', first.outputs, expect.any(AbortSignal))
    expect(second.onRunningChange).not.toHaveBeenCalled()
    await second.result.current.run('second')
    expect(mocks.remoteRun).toHaveBeenLastCalledWith('second', second.outputs, expect.any(AbortSignal))
  })

  it('aborts a run when its editor unmounts without showing a failure toast', async () => {
    mocks.remoteRun.mockImplementation((_code, _outputs, signal: AbortSignal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    }))
    const { result, unmount, onRunningChange } = mountRunner()
    const pending = result.current.run('main() {}')
    unmount()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(onRunningChange.mock.calls).toEqual([[true], [false]])
    expect(mocks.dismiss).toHaveBeenCalledOnce()
    expect(mocks.error).not.toHaveBeenCalled()
    expect(isBusy()).toBe(false)
  })

  it('cancels the prior lesson command when the editor scope changes', async () => {
    mocks.remoteRun.mockImplementation((_code, _outputs, signal: AbortSignal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    }))
    const outputs = { setToolOutput: vi.fn(), setProgramOutput: vi.fn(), setTruncation: vi.fn() }
    const { result, rerender } = renderHook(({ scopeKey }) => useCodeRunner({ outputs, scopeKey }), {
      initialProps: { scopeKey: 'lesson one' },
    })
    const pending = result.current.run('old code')
    rerender({ scopeKey: 'lesson two' })
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(isBusy()).toBe(false)
    mocks.remoteRun.mockResolvedValue(undefined)
    await result.current.run('new code')
    expect(mocks.remoteRun).toHaveBeenLastCalledWith('new code', outputs, expect.objectContaining({ aborted: false }))
  })

  it('returns formatter edits without rewriting results or reporting a run', async () => {
    mocks.format.mockResolvedValue('main() {}')
    const { result, outputs, onRunningChange } = mountRunner()
    await expect(result.current.format('main(){}')).resolves.toBe('main() {}')
    expect(onRunningChange).not.toHaveBeenCalled()
    expect(outputs.setToolOutput).not.toHaveBeenCalled()
    expect(outputs.setResult).not.toHaveBeenCalled()
  })

  it('settles formatter failures and releases the command lock', async () => {
    const failure = new Error('invalid source')
    mocks.format.mockRejectedValue(failure)
    const { result } = mountRunner()
    await expect(result.current.format('bad')).rejects.toBe(failure)
    expect(isBusy()).toBe(false)
    expect(mocks.error).toHaveBeenCalledOnce()
  })

  it('stops waiting for a canceled formatter and ignores its late result', async () => {
    let finish!: (value: string) => void
    mocks.format.mockImplementation(() => new Promise<string>((resolve) => {
      finish = resolve
    }))
    const { result } = mountRunner()
    const controller = new AbortController()
    const pending = result.current.format('main(){}', controller.signal)
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(isBusy()).toBe(false)
    finish('late')
    await Promise.resolve()
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.error).not.toHaveBeenCalled()
  })
})
