import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CodeRunner from './CodeRunner'
import { eventEmitter, EVENTS } from '@/lib/events'
import { isBusy, remoteLock } from '@/lib/lock'

const mocks = vi.hoisted(() => ({
  remoteRun: vi.fn(),
  format: vi.fn(),
  pending: [] as Promise<unknown>[],
}))

vi.mock('@/service/run', () => ({ remoteRun: mocks.remoteRun }))
vi.mock('@/lib/cangjie-formatter', () => ({ browserCangjieFormatter: { format: mocks.format } }))
vi.mock('@lingui/react', () => ({
  useLingui: () => ({ i18n: { _: ({ message }: { message: string }) => message } }),
}))
vi.mock('sonner', () => ({
  toast: {
    promise: (work: () => Promise<unknown>) => {
      const pending = work()
      mocks.pending.push(pending)
      void pending.catch(() => {})
    },
  },
}))

function mountRunner(onRunningChange?: (running: boolean) => void) {
  const outputs = { setToolOutput: vi.fn(), setProgramOutput: vi.fn(), setTruncation: vi.fn() }
  render(<CodeRunner {...outputs} onRunningChange={onRunningChange} />)
  return outputs
}

describe('codeRunner execution lifecycle', () => {
  beforeEach(() => {
    mocks.remoteRun.mockReset()
    mocks.format.mockReset()
    mocks.pending.length = 0
  })

  afterEach(cleanup)

  it('reports running only while the accepted command holds the run lock', async () => {
    let finish!: () => void
    mocks.remoteRun.mockImplementation(() => new Promise<void>((resolve) => {
      finish = resolve
    }))
    const onRunningChange = vi.fn()
    const outputs = mountRunner(onRunningChange)

    eventEmitter.emit(EVENTS.RUN_CODE, 'main() {}')
    try {
      expect(onRunningChange.mock.calls).toEqual([[true]])
      expect(isBusy()).toBe(true)
      expect(mocks.remoteRun).toHaveBeenCalledWith('main() {}', outputs)

      eventEmitter.emit(EVENTS.RUN_CODE, 'ignored while busy')
      expect(mocks.remoteRun).toHaveBeenCalledTimes(1)
      expect(onRunningChange.mock.calls).toEqual([[true]])
    }
    finally {
      finish()
      await mocks.pending[0]
    }

    expect(onRunningChange.mock.calls).toEqual([[true], [false]])
    expect(isBusy()).toBe(false)
  })

  it('clears running when the remote command rejects without swallowing the error', async () => {
    const failure = new Error('compile failed')
    mocks.remoteRun.mockRejectedValue(failure)
    const onRunningChange = vi.fn()
    mountRunner(onRunningChange)

    eventEmitter.emit(EVENTS.RUN_CODE, 'invalid code')
    await expect(mocks.pending[0]).rejects.toBe(failure)

    expect(onRunningChange.mock.calls).toEqual([[true], [false]])
    expect(isBusy()).toBe(false)
  })

  it('does not report running for a command rejected by an existing lock', async () => {
    let release!: () => void
    const lock = remoteLock.acquire('run', () => new Promise<void>((resolve) => {
      release = resolve
    }))
    const onRunningChange = vi.fn()
    mountRunner(onRunningChange)

    try {
      eventEmitter.emit(EVENTS.RUN_CODE, 'ignored')
      expect(onRunningChange).not.toHaveBeenCalled()
      expect(mocks.remoteRun).not.toHaveBeenCalled()
      expect(mocks.pending).toHaveLength(0)
    }
    finally {
      release()
      await lock
    }
  })

  it('keeps callers without a lifecycle callback compatible', async () => {
    mocks.remoteRun.mockResolvedValue(undefined)
    mountRunner()

    eventEmitter.emit(EVENTS.RUN_CODE, 'main() {}')
    await mocks.pending[0]

    expect(mocks.remoteRun).toHaveBeenCalledTimes(1)
  })

  it('does not label formatting as a run', async () => {
    mocks.format.mockResolvedValue('main() {}')
    const onRunningChange = vi.fn()
    mountRunner(onRunningChange)

    eventEmitter.emit(EVENTS.FORMAT_CODE, 'main(){}')
    await mocks.pending[0]

    expect(mocks.format).toHaveBeenCalledWith('main(){}')
    expect(onRunningChange).not.toHaveBeenCalled()
  })
})
