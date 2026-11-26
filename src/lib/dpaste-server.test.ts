import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getShareCode, getShareCodeResult } from './dpaste-server'

const { httpsRequestMock } = vi.hoisted(() => ({
  httpsRequestMock: vi.fn(),
}))

vi.mock('node:https', () => ({
  request: httpsRequestMock,
}))

function mockHttpsResponse(statusCode: number, body: string) {
  httpsRequestMock.mockImplementationOnce((_url: unknown, _opts: unknown, cb: (res: EventEmitter & { statusCode?: number, setEncoding: (enc: string) => void }) => void) => {
    const req = Object.assign(new EventEmitter(), {
      setTimeout: vi.fn(),
      end: vi.fn(() => {
        const res = Object.assign(new EventEmitter(), {
          statusCode,
          setEncoding: vi.fn(),
          destroy: vi.fn(),
        })
        cb(res)
        if (body)
          res.emit('data', body)
        res.emit('end')
      }),
      destroy: vi.fn(),
    })
    return req
  })
}

function mockHttpsError(error: Error) {
  httpsRequestMock.mockImplementationOnce(() => {
    const req = Object.assign(new EventEmitter(), {
      setTimeout: vi.fn(),
      end: vi.fn(() => {
        queueMicrotask(() => req.emit('error', error))
      }),
      destroy: vi.fn(),
    })
    return req
  })
}

describe('dpaste-server structured share loading', () => {
  afterEach(() => {
    httpsRequestMock.mockReset()
  })

  it('returns invalid_hash without calling dpaste for malformed hashes', async () => {
    await expect(getShareCodeResult('../bad')).resolves.toEqual({
      ok: false,
      reason: 'invalid_hash',
    })
    expect(httpsRequestMock).not.toHaveBeenCalled()
  })

  it('returns ok with code for HTTP 200 responses', async () => {
    mockHttpsResponse(200, 'main() {}')
    await expect(getShareCodeResult('abc123')).resolves.toEqual({
      ok: true,
      code: 'main() {}',
    })
  })

  it('returns not_found for expired/missing 404 pastes instead of rejecting', async () => {
    mockHttpsResponse(404, 'Not found')
    await expect(getShareCodeResult('expired99')).resolves.toEqual({
      ok: false,
      reason: 'not_found',
      status: 404,
    })
  })

  it('returns timeout and unavailable instead of rejecting on network failures', async () => {
    mockHttpsError(new Error('dpaste request timed out'))
    await expect(getShareCodeResult('slow1')).resolves.toEqual({
      ok: false,
      reason: 'timeout',
    })

    mockHttpsError(new Error('ECONNRESET'))
    await expect(getShareCodeResult('broken1')).resolves.toEqual({
      ok: false,
      reason: 'unavailable',
    })

    mockHttpsError(new Error('ECONNRESET'))
    await expect(getShareCode('broken2')).resolves.toEqual({
      ok: false,
      reason: 'unavailable',
    })
  })
})
