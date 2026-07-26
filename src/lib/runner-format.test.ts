import { describe, expect, it, vi } from 'vitest'
import { applyCompleteFormattedSource } from './runner-format'

describe('applyCompleteFormattedSource', () => {
  it('fails closed without replacing the editor when formatted source is truncated', () => {
    const onFormatted = vi.fn()

    expect(applyCompleteFormattedSource({
      formatted: 'partial source',
      formatted_truncated: true,
      formatter_output: '',
      formatter_output_truncated: false,
      formatter_code: 0,
    }, onFormatted)).toBe(false)
    expect(onFormatted).not.toHaveBeenCalled()
  })

  it('applies a complete successful formatter result', () => {
    const onFormatted = vi.fn()

    expect(applyCompleteFormattedSource({
      formatted: 'main() {}',
      formatted_truncated: false,
      formatter_output: '',
      formatter_output_truncated: false,
      formatter_code: 0,
    }, onFormatted)).toBe(true)
    expect(onFormatted).toHaveBeenCalledWith('main() {}')
  })
})
