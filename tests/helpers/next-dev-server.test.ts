// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'
import { findExistingDevServerUrl } from './next-dev-server'

describe('findExistingDevServerUrl', () => {
  it('checks both loopback hostnames before starting a new Next dev server', async () => {
    const fetchPage = vi.fn()
      .mockRejectedValueOnce(new Error('127 unavailable'))
      .mockResolvedValueOnce(new Response('<html><div id="__next"></div></html>', { status: 200 }))

    await expect(findExistingDevServerUrl(fetchPage)).resolves.toBe('http://localhost:3000')
    expect(fetchPage).toHaveBeenCalledWith('http://127.0.0.1:3000/zh')
    expect(fetchPage).toHaveBeenCalledWith('http://localhost:3000/zh')
  })
})
