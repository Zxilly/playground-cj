import { describe, expect, it } from 'vitest'
import { failWithRetryHint } from './fail-with-retry-hint'

describe('failWithRetryHint', () => {
  it('wraps an Error with expectedShape', () => {
    const example = { foo: 'bar', body: [{ text: 'hi' }] }
    const result = failWithRetryHint(new Error('boom'), example)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('boom')
    expect(result.expectedShape).toEqual(example)
  })

  it('handles non-Error values', () => {
    const example = { x: 1 }
    const result = failWithRetryHint('string-error', example)
    expect(result.error).toBe('string-error')
    expect(result.expectedShape).toEqual(example)
  })

  it('handles null/undefined', () => {
    const example = { x: 1 }
    const result = failWithRetryHint(null, example)
    expect(result.error).toBe('null')
  })
})
