import { describe, expect, it } from 'vitest'
import { createSharedGatewayBulkhead } from './shared-gateway-bulkhead'

describe('shared gateway bulkhead', () => {
  it('bounds concurrent work and releases a slot exactly once', () => {
    const bulkhead = createSharedGatewayBulkhead(1)
    const release = bulkhead.tryAcquire()

    expect(release).not.toBeNull()
    expect(bulkhead.tryAcquire()).toBeNull()

    release?.()
    release?.()
    expect(bulkhead.tryAcquire()).not.toBeNull()
  })

  it('rejects invalid limits', () => {
    expect(() => createSharedGatewayBulkhead(0)).toThrow(
      'concurrency limit must be a positive integer',
    )
  })
})
