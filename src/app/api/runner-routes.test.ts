import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  maxDuration as formatMaxDuration,
  POST as postFormat,
} from './format/route'
import {
  POST as postRun,
  maxDuration as runMaxDuration,
} from './run/route'

const proxyToRunner = vi.hoisted(() => vi.fn())

vi.mock('@/lib/runner-proxy', () => ({ proxyToRunner }))

describe('runner API routes', () => {
  beforeEach(() => {
    proxyToRunner.mockReset()
    proxyToRunner.mockResolvedValue(new Response(null, { status: 204 }))
  })

  it('delegates POST /api/run to the run action', async () => {
    const request = new Request('http://localhost/api/run', { method: 'POST' })

    await expect(postRun(request)).resolves.toMatchObject({ status: 204 })
    expect(proxyToRunner).toHaveBeenCalledWith(request, 'run')
    expect(runMaxDuration).toBe(30)
  })

  it('delegates POST /api/format to the format action', async () => {
    const request = new Request('http://localhost/api/format', { method: 'POST' })

    await expect(postFormat(request)).resolves.toMatchObject({ status: 204 })
    expect(proxyToRunner).toHaveBeenCalledWith(request, 'format')
    expect(formatMaxDuration).toBe(30)
  })
})
