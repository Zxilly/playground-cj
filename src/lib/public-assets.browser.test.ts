import { describe, expect, it } from 'vitest'

describe('public browser assets', () => {
  it('serves the app icon as a decodable browser image', async () => {
    const response = await fetch('/icon.png')
    expect(response.ok).toBe(true)
    expect(response.headers.get('content-type')).toContain('image/png')

    const bitmap = await createImageBitmap(await response.blob())
    expect(bitmap.width).toBeGreaterThan(0)
    expect(bitmap.height).toBeGreaterThan(0)
    bitmap.close()
  })
})
