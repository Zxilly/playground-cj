export interface SharedGatewayBulkhead {
  tryAcquire: () => (() => void) | null
}

export function createSharedGatewayBulkhead(
  maximumConcurrentRequests: number,
): SharedGatewayBulkhead {
  if (!Number.isSafeInteger(maximumConcurrentRequests) || maximumConcurrentRequests <= 0)
    throw new Error('shared gateway concurrency limit must be a positive integer')

  let activeRequests = 0
  return {
    tryAcquire() {
      if (activeRequests >= maximumConcurrentRequests)
        return null
      activeRequests += 1
      let released = false
      return () => {
        if (released)
          return
        released = true
        activeRequests -= 1
      }
    },
  }
}

const defaultBulkheads = new Map<string, {
  limit: number
  bulkhead: SharedGatewayBulkhead
}>()

export function getSharedGatewayBulkhead(
  maximumConcurrentRequests: number,
  scope = 'model',
): SharedGatewayBulkhead {
  const existing = defaultBulkheads.get(scope)
  if (existing && existing.limit !== maximumConcurrentRequests) {
    throw new Error(
      `shared gateway ${scope} concurrency limit changed after initialization`,
    )
  }
  if (!existing) {
    const bulkhead = createSharedGatewayBulkhead(maximumConcurrentRequests)
    defaultBulkheads.set(scope, {
      limit: maximumConcurrentRequests,
      bulkhead,
    })
    return bulkhead
  }
  return existing.bulkhead
}
