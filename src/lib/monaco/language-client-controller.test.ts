import { describe, expect, it, vi } from 'vitest'
import { LatestLanguageClientController } from './language-client-controller'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function client(start: Promise<void> = Promise.resolve()) {
  return {
    start: vi.fn(() => start),
    stop: vi.fn(async () => {}),
    dispose: vi.fn(async () => {}),
  }
}

describe('latestLanguageClientController', () => {
  it('disposes a stale client whose start finishes after a replacement was requested', async () => {
    const oldStart = deferred()
    const oldClient = client(oldStart.promise)
    const newClient = client()
    const oldPort = {}
    const newPort = {}
    const create = vi.fn(async (port: object) => port === oldPort ? oldClient : newClient)
    const controller = new LatestLanguageClientController<object, typeof oldClient>()

    const oldResult = controller.ensure(oldPort, create)
    await vi.waitFor(() => expect(oldClient.start).toHaveBeenCalled())
    const newResult = controller.ensure(newPort, create)
    oldStart.resolve()

    await expect(oldResult).resolves.toBeUndefined()
    await expect(newResult).resolves.toBe(newClient)
    expect(oldClient.stop).toHaveBeenCalledOnce()
    expect(oldClient.dispose).toHaveBeenCalledOnce()
    await expect(controller.ensure(newPort, create)).resolves.toBe(newClient)
  })

  it('coalesces concurrent requests for the same port', async () => {
    const start = deferred()
    const onlyClient = client(start.promise)
    const create = vi.fn(async () => onlyClient)
    const controller = new LatestLanguageClientController<object, typeof onlyClient>()
    const port = {}

    const first = controller.ensure(port, create)
    const second = controller.ensure(port, create)
    start.resolve()

    await expect(first).resolves.toBe(onlyClient)
    await expect(second).resolves.toBe(onlyClient)
    expect(create).toHaveBeenCalledOnce()
    expect(onlyClient.start).toHaveBeenCalledOnce()
  })
})
