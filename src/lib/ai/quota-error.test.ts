import { describe, expect, it } from 'vitest'
import { isQuotaExhaustedError } from './quota-error'

describe('isQuotaExhaustedError', () => {
  it('matches the new-api Chinese phrasing in the error message', () => {
    expect(isQuotaExhaustedError(new Error('用户额度不足, 剩余额度: $0'))).toBe(true)
  })

  it('matches the error code in an APICallError responseBody', () => {
    const apiError = Object.assign(new Error('AI_APICallError'), {
      statusCode: 403,
      responseBody: '{"error":{"message":"用户额度不足","code":"insufficient_user_quota"}}',
    })
    expect(isQuotaExhaustedError(apiError)).toBe(true)
  })

  it('matches the English "insufficient quota" phrasing', () => {
    expect(isQuotaExhaustedError(new Error('Insufficient quota for this request'))).toBe(true)
  })

  it('matches token-level exhaustion messages', () => {
    expect(isQuotaExhaustedError(new Error('token quota is not enough, token remain quota: 0'))).toBe(true)
  })

  it('drills into a wrapped cause chain', () => {
    const inner = new Error('insufficient_user_quota')
    const outer = Object.assign(new Error('wrapper'), { cause: inner })
    expect(isQuotaExhaustedError(outer)).toBe(true)
  })

  it('returns false for unrelated errors', () => {
    expect(isQuotaExhaustedError(new Error('network down'))).toBe(false)
    expect(isQuotaExhaustedError(new Error('rate limit exceeded'))).toBe(false)
    expect(isQuotaExhaustedError(null)).toBe(false)
    expect(isQuotaExhaustedError(undefined)).toBe(false)
  })

  it('handles bare string error payloads', () => {
    expect(isQuotaExhaustedError('额度不足')).toBe(true)
    expect(isQuotaExhaustedError('hello')).toBe(false)
  })

  it('reads the JSON-serialised data field when present', () => {
    const apiError = { data: { error: { code: 'insufficient_user_quota' } } }
    expect(isQuotaExhaustedError(apiError)).toBe(true)
  })
})
