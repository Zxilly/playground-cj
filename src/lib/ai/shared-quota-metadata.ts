import type { SharedQuotaMetadata } from './shared-quota-broker'
import { awaitWithSignal } from './abortable-operation'

const WINDOW_MS = 60_000

export class SharedQuotaMetadataRateLimitError extends Error {}
export class SharedQuotaMetadataBusyError extends Error {}

export interface SharedQuotaMetadataReader {
  read: (identity: string, signal?: AbortSignal) => Promise<SharedQuotaMetadata>
}

export interface SharedQuotaMetadataReaderDependencies {
  readonly readQuota: (
    identity: string,
    signal?: AbortSignal,
  ) => Promise<SharedQuotaMetadata>
  readonly consumeDistributedPermit: (
    identity: string,
    signal?: AbortSignal,
  ) => Promise<boolean>
  readonly tryAcquireSlot: () => (() => void) | null
  readonly now: () => number
  readonly timeoutMs: number
  readonly cacheTtlMs: number
  readonly cacheMaxEntries: number
  readonly identityRequestsPerMinute: number
  readonly globalRequestsPerMinute: number
}

interface CacheEntry {
  quota: SharedQuotaMetadata
  expiresAt: number
  lastAccessSequence: number
}

function positiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`${label} must be a positive integer`)
}

function cloneQuota(quota: SharedQuotaMetadata): SharedQuotaMetadata {
  return { ...quota }
}

export function createSharedQuotaMetadataReader(
  dependencies: SharedQuotaMetadataReaderDependencies,
): SharedQuotaMetadataReader {
  positiveInteger(dependencies.timeoutMs, 'metadata timeout')
  positiveInteger(dependencies.cacheTtlMs, 'metadata cache TTL')
  positiveInteger(dependencies.cacheMaxEntries, 'metadata cache entry limit')
  positiveInteger(
    dependencies.identityRequestsPerMinute,
    'metadata identity request limit',
  )
  positiveInteger(
    dependencies.globalRequestsPerMinute,
    'metadata global request limit',
  )
  if (
    dependencies.globalRequestsPerMinute
    < dependencies.identityRequestsPerMinute
  ) {
    throw new Error(
      'metadata global request limit must be at least the identity request limit',
    )
  }

  const cache = new Map<string, CacheEntry>()
  const inFlight = new Map<string, Promise<SharedQuotaMetadata>>()
  let localBucket = Number.NaN
  let localGlobalCount = 0
  let cacheAccessSequence = 0
  const localIdentityCounts = new Map<string, number>()

  function consumeLocalPermit(identity: string): boolean {
    const bucket = Math.floor(dependencies.now() / WINDOW_MS)
    if (bucket !== localBucket) {
      localBucket = bucket
      localGlobalCount = 0
      localIdentityCounts.clear()
    }
    const identityCount = localIdentityCounts.get(identity) ?? 0
    if (
      identityCount >= dependencies.identityRequestsPerMinute
      || localGlobalCount >= dependencies.globalRequestsPerMinute
    ) {
      return false
    }
    localIdentityCounts.set(identity, identityCount + 1)
    localGlobalCount += 1
    return true
  }

  function cacheQuota(identity: string, quota: SharedQuotaMetadata): void {
    if (!cache.has(identity) && cache.size >= dependencies.cacheMaxEntries) {
      let oldestIdentity: string | null = null
      let oldestAccess = Number.POSITIVE_INFINITY
      for (const [candidate, entry] of cache) {
        if (entry.lastAccessSequence < oldestAccess) {
          oldestIdentity = candidate
          oldestAccess = entry.lastAccessSequence
        }
      }
      if (oldestIdentity !== null)
        cache.delete(oldestIdentity)
    }
    const now = dependencies.now()
    cache.set(identity, {
      quota: cloneQuota(quota),
      expiresAt: now + dependencies.cacheTtlMs,
      lastAccessSequence: ++cacheAccessSequence,
    })
  }

  function startRead(identity: string): Promise<SharedQuotaMetadata> {
    const release = dependencies.tryAcquireSlot()
    if (!release)
      return Promise.reject(new SharedQuotaMetadataBusyError('metadata service is busy'))

    const signal = AbortSignal.timeout(dependencies.timeoutMs)
    const operation = (async () => {
      try {
        // Callers may stop waiting below, but this shared operation owns the
        // slot until each dependency really settles.
        signal.throwIfAborted()
        const permitted = await dependencies.consumeDistributedPermit(identity, signal)
        signal.throwIfAborted()
        if (!permitted)
          throw new SharedQuotaMetadataRateLimitError('metadata rate limit exceeded')
        const quota = await dependencies.readQuota(identity, signal)
        signal.throwIfAborted()
        cacheQuota(identity, quota)
        return cloneQuota(quota)
      }
      finally {
        release()
      }
    })()
    inFlight.set(identity, operation)
    void operation.finally(() => {
      if (inFlight.get(identity) === operation)
        inFlight.delete(identity)
    }).catch(() => undefined)
    return operation
  }

  return {
    async read(identity: string, requestSignal?: AbortSignal) {
      if (!identity || identity.length > 256)
        throw new Error('invalid shared quota identity')
      if (!consumeLocalPermit(identity))
        throw new SharedQuotaMetadataRateLimitError('metadata rate limit exceeded')

      const now = dependencies.now()
      const cached = cache.get(identity)
      if (cached && now < cached.expiresAt) {
        cached.lastAccessSequence = ++cacheAccessSequence
        return cloneQuota(cached.quota)
      }
      if (cached)
        cache.delete(identity)

      const operation = inFlight.get(identity) ?? startRead(identity)
      const waitSignal = requestSignal
        ? AbortSignal.any([
            requestSignal,
            AbortSignal.timeout(dependencies.timeoutMs),
          ])
        : AbortSignal.timeout(dependencies.timeoutMs)
      return cloneQuota(await awaitWithSignal(operation, waitSignal))
    },
  }
}

let defaultReader: SharedQuotaMetadataReader | null = null
let defaultSignature: string | null = null

export function getSharedQuotaMetadataReader(
  dependencies: SharedQuotaMetadataReaderDependencies,
): SharedQuotaMetadataReader {
  const signature = JSON.stringify({
    timeoutMs: dependencies.timeoutMs,
    cacheTtlMs: dependencies.cacheTtlMs,
    cacheMaxEntries: dependencies.cacheMaxEntries,
    identityRequestsPerMinute: dependencies.identityRequestsPerMinute,
    globalRequestsPerMinute: dependencies.globalRequestsPerMinute,
  })
  if (defaultReader && defaultSignature !== signature)
    throw new Error('shared quota metadata configuration changed after initialization')
  if (!defaultReader) {
    defaultReader = createSharedQuotaMetadataReader(dependencies)
    defaultSignature = signature
  }
  return defaultReader
}
