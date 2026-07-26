import { describe, expect, it, vi } from 'vitest'
import { createCangjieFormatter } from './cangjie-formatter'

describe('createCangjieFormatter', () => {
  it('loads the WASM module once and formats multiple sources', async () => {
    const formatCangjie = vi.fn((source: string, path: string) => ({
      success: true,
      formatted: `${path}:${source}`,
    }))
    const loadModule = vi.fn(async () => ({ formatCangjie }))
    const formatter = createCangjieFormatter(loadModule)

    await expect(formatter.format('main(){}')).resolves.toBe('main.cj:main(){}')
    await expect(formatter.format('let x=1', 'lib.cj')).resolves.toBe('lib.cj:let x=1')

    expect(loadModule).toHaveBeenCalledTimes(1)
    expect(formatCangjie).toHaveBeenCalledTimes(2)
  })

  it('rejects unsuccessful formatter results without exposing partial source', async () => {
    const formatter = createCangjieFormatter(async () => ({
      formatCangjie: () => ({
        success: false,
        formatted: 'partial source',
      }),
    }))

    await expect(formatter.format('original source')).rejects.toThrow(
      'Cangjie formatter rejected the source',
    )
  })

  it('rejects malformed results from the WASM boundary', async () => {
    const formatter = createCangjieFormatter(async () => ({
      formatCangjie: () => ({
        success: true,
        formatted: 42,
      }),
    }))

    await expect(formatter.format('main() {}')).rejects.toThrow(
      'Cangjie formatter returned an invalid result',
    )
  })
})
