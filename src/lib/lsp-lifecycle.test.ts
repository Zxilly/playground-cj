import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

class FakePort {
  closed = false
  onmessage: ((event: MessageEvent) => void) | null = null

  close() {
    this.closed = true
  }

  postMessage() {}
  start() {}
}

class FakeWorker {
  static instances: FakeWorker[] = []
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  terminated = false
  transferredPort: FakePort | null = null

  constructor() {
    FakeWorker.instances.push(this)
  }

  postMessage(message: { serverPort: FakePort }) {
    this.transferredPort = message.serverPort
  }

  ready() {
    this.onmessage?.({ data: { type: 'ready' } } as MessageEvent)
  }

  terminate() {
    this.terminated = true
  }
}

function resetLspSlot(): void {
  const store = (globalThis as unknown as Record<symbol, {
    slots: Map<string, unknown>
  }>)[Symbol.for('playground-cj.hmr-store')]
  store?.slots.delete('lsp.state')
}

describe('lsp runtime worker lifecycle', () => {
  beforeEach(() => {
    resetLspSlot()
    FakeWorker.instances = []
    vi.resetModules()
    vi.stubGlobal('Worker', FakeWorker)
    vi.stubGlobal('MessageChannel', class {
      port1 = new FakePort()
      port2 = new FakePort()
    })
  })

  afterEach(() => {
    resetLspSlot()
    vi.unstubAllGlobals()
  })

  it('terminates a stalled generation and starts the next generation cleanly', async () => {
    const lsp = await import('./lsp')
    const stalledStart = lsp.startLsp('manual')
    await vi.waitFor(() => expect(FakeWorker.instances).toHaveLength(1))
    const first = FakeWorker.instances[0]!

    await lsp.stopLsp('manual')
    await stalledStart
    expect(first.terminated).toBe(true)
    expect(lsp.getCurrentEditorPort()).toBeNull()

    const secondStart = lsp.startLsp('manual')
    await vi.waitFor(() => expect(FakeWorker.instances).toHaveLength(2))
    const second = FakeWorker.instances[1]!
    second.ready()
    await secondStart
    expect(lsp.getLspStatus().state).toBe('running')

    await lsp.stopLsp('manual')
    expect(second.terminated).toBe(true)
    expect(lsp.getLspStatus().state).toBe('stopped')
  })
})
