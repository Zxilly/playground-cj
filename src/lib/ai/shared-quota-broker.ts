import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { getRedis } from '@/lib/redis'
import {
  deleteQuotaToken,
  fetchTokenDetail,
  fetchTokenKey,
  findTokenIdByName,
  listManagedQuotaTokens,
  provisionQuotaToken,
  resetTokenRemainQuota,
  TOKEN_STATUS_ENABLED,
  TOKEN_STATUS_EXHAUSTED,
  TOKEN_STATUS_EXPIRED,
} from '@/lib/new-api'
import { nextResetAtMs } from '@/lib/quota-reset'

export const SHARED_QUOTA_PER_PERIOD = 1_000_000

const LOCK_TTL_SECONDS = 30
const POLL_ATTEMPTS = 100
const POLL_INTERVAL_MS = 50
const CACHE_PREFIX = 'shared-ai:credential:'
const LOCK_PREFIX = 'shared-ai:credential-lock:'
const PROVISION_LOCK_KEY = 'shared-ai:credential-provision-lock:v1'
const TOKEN_NAME_PREFIX = 'pcj:s:'
const TOKEN_NAME_MAX_LENGTH = 30
const TOKEN_INACTIVITY_GRACE_MS = 24 * 60 * 60 * 1_000
const TOKEN_DELETE_GRACE_MS = 60 * 1_000
const MAX_CACHE_TTL_SECONDS = 2 * 24 * 60 * 60
export const MAX_MANAGED_QUOTA_TOKENS = 512

const cachedCredentialSchema = z.strictObject({
  tokenId: z.number().int().positive(),
  apiKey: z.string().min(1).max(4_096),
  nextResetAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().positive(),
})

type CachedCredential = z.infer<typeof cachedCredentialSchema>

const tokenDetailSchema = z.object({
  status: z.number().int(),
  remain_quota: z.number().finite(),
})

interface RedisPort {
  get: <T>(key: string, signal?: AbortSignal) => Promise<T | null>
  set: (
    key: string,
    value: unknown,
    options: { nx?: true, ex: number },
    signal?: AbortSignal,
  ) => Promise<unknown>
  eval: (
    script: string,
    keys: string[],
    args: string[],
    signal?: AbortSignal,
  ) => Promise<unknown>
}

interface TokenDetail {
  readonly status: number
  readonly remain_quota: number
}

export interface SharedCredential {
  readonly tokenId: number
  readonly apiKey: string
  readonly nextResetAt: number
}

export interface SharedQuotaMetadata {
  readonly nextResetAt: number
  readonly perPeriod: number
  readonly available: number
  readonly exhausted: boolean
}

export interface SharedQuotaBroker {
  acquireCredential: (identity: string, signal?: AbortSignal) => Promise<SharedCredential>
  readQuota: (identity: string, signal?: AbortSignal) => Promise<SharedQuotaMetadata>
}

export interface SharedQuotaBrokerDependencies {
  readonly redis: RedisPort
  readonly lookup: (name: string, signal?: AbortSignal) => Promise<{
    tokenId: number
    key: string
    expiresAt: number
  } | null>
  readonly provision: (
    name: string,
    quota: number,
    expiresAtSeconds: number,
    signal?: AbortSignal,
  ) => Promise<{ tokenId: number, key: string }>
  readonly reset: (
    tokenId: number,
    quota: number,
    expiresAtSeconds: number,
    signal?: AbortSignal,
  ) => Promise<void>
  readonly detail: (tokenId: number, signal?: AbortSignal) => Promise<TokenDetail>
  readonly listManaged: (
    prefix: string,
    signal?: AbortSignal,
  ) => Promise<readonly ManagedQuotaToken[]>
  readonly remove: (tokenId: number, signal?: AbortSignal) => Promise<void>
  readonly now: () => number
  readonly sleep: (milliseconds: number) => Promise<void>
  readonly lockOwner: () => string
  readonly identityDigest: (identity: string) => string
}

export interface ManagedQuotaToken {
  readonly tokenId: number
  readonly name: string
  /** Absolute Unix time in milliseconds. */
  readonly expiresAt: number
}

const RELEASE_LOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`.trim()

function parseCached(value: unknown): CachedCredential | null {
  const parsed = cachedCredentialSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

function isCurrent(value: CachedCredential, now: number): boolean {
  return now < value.nextResetAt && now < value.expiresAt
}

function validateIdentity(identity: string): void {
  if (!identity || identity.length > 256)
    throw new Error('invalid shared quota identity')
}

function tokenNameForDigest(digest: string): string {
  return `${TOKEN_NAME_PREFIX}${digest.slice(
    0,
    TOKEN_NAME_MAX_LENGTH - TOKEN_NAME_PREFIX.length,
  )}`
}

function tokenExpiryAt(now: number): number {
  return nextResetAtMs(now) + TOKEN_INACTIVITY_GRACE_MS
}

function unixSeconds(timestamp: number): number {
  return Math.ceil(timestamp / 1_000)
}

function cacheTtlSeconds(value: CachedCredential, now: number): number {
  return Math.max(
    1,
    Math.min(MAX_CACHE_TTL_SECONDS, unixSeconds(value.expiresAt - now)),
  )
}

function recoveredCredential(
  recovered: { tokenId: number, key: string, expiresAt: number },
  now: number,
): CachedCredential | null {
  if (recovered.expiresAt <= now)
    return null
  return cachedCredentialSchema.parse({
    tokenId: recovered.tokenId,
    apiKey: recovered.key,
    nextResetAt: nextResetAtMs(now),
    expiresAt: recovered.expiresAt,
  })
}

async function awaitDependencySettlement<T>(
  operation: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  signal?.throwIfAborted()
  const result = await operation()
  signal?.throwIfAborted()
  return result
}

export function createSharedQuotaBroker(
  dependencies: SharedQuotaBrokerDependencies,
): SharedQuotaBroker {
  async function readCached(
    cacheKey: string,
    signal?: AbortSignal,
  ): Promise<CachedCredential | null> {
    return parseCached(await awaitDependencySettlement(
      () => dependencies.redis.get<unknown>(cacheKey, signal),
      signal,
    ))
  }

  async function writeCached(
    cacheKey: string,
    value: CachedCredential,
    signal?: AbortSignal,
  ): Promise<void> {
    await awaitDependencySettlement(
      () => dependencies.redis.set(
        cacheKey,
        cachedCredentialSchema.parse(value),
        { ex: cacheTtlSeconds(value, dependencies.now()) },
        signal,
      ),
      signal,
    )
  }

  async function acquireLock(
    lockKey: string,
    owner: string,
    signal?: AbortSignal,
  ): Promise<boolean> {
    return Boolean(await awaitDependencySettlement(
      () => dependencies.redis.set(lockKey, owner, {
        nx: true,
        ex: LOCK_TTL_SECONDS,
      }, signal),
      signal,
    ))
  }

  async function waitForLock(
    lockKey: string,
    owner: string,
    signal?: AbortSignal,
  ): Promise<void> {
    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
      if (await acquireLock(lockKey, owner, signal))
        return
      await awaitDependencySettlement(
        () => dependencies.sleep(POLL_INTERVAL_MS),
        signal,
      )
    }
    throw new Error('shared credential broker is busy')
  }

  async function releaseLock(lockKey: string, owner: string): Promise<void> {
    try {
      // Cleanup must not inherit an already-aborted caller signal. It gets its
      // own strict budget so a dead Redis dependency cannot retain request
      // ownership forever.
      const cleanupSignal = AbortSignal.timeout(2_000)
      await dependencies.redis.eval(
        RELEASE_LOCK_SCRIPT,
        [lockKey],
        [owner],
        cleanupSignal,
      )
    }
    catch {
      // The lock itself expires after a short TTL. Callers still wait for this
      // release attempt to settle before their outer admission slot is free.
    }
  }

  async function waitForOwner(cacheKey: string, signal?: AbortSignal): Promise<CachedCredential> {
    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
      await awaitDependencySettlement(
        () => dependencies.sleep(POLL_INTERVAL_MS),
        signal,
      )
      const cached = await readCached(cacheKey, signal)
      if (cached && isCurrent(cached, dependencies.now()))
        return cached
    }
    throw new Error('shared credential broker is busy')
  }

  async function provisionWithCapacity(
    tokenName: string,
    signal?: AbortSignal,
  ): Promise<CachedCredential> {
    const owner = dependencies.lockOwner()
    await waitForLock(PROVISION_LOCK_KEY, owner, signal)
    try {
      const now = dependencies.now()
      const recovered = await awaitDependencySettlement(
        () => dependencies.lookup(tokenName, signal),
        signal,
      )
      if (recovered) {
        const active = recoveredCredential(recovered, now)
        if (active)
          return active
      }

      const managed = await awaitDependencySettlement(
        () => dependencies.listManaged(TOKEN_NAME_PREFIX, signal),
        signal,
      )
      const seenIds = new Set<number>()
      const seenNames = new Set<string>()
      let retained = 0
      let retainedExact = false
      for (const token of managed) {
        if (
          !Number.isInteger(token.tokenId)
          || token.tokenId <= 0
          || !token.name.startsWith(TOKEN_NAME_PREFIX)
          || !Number.isSafeInteger(token.expiresAt)
          || token.expiresAt <= 0
          || seenIds.has(token.tokenId)
          || seenNames.has(token.name)
        ) {
          throw new Error('new-api returned an invalid managed token inventory')
        }
        seenIds.add(token.tokenId)
        seenNames.add(token.name)
        if (token.expiresAt + TOKEN_DELETE_GRACE_MS <= now) {
          await awaitDependencySettlement(
            () => dependencies.remove(token.tokenId, signal),
            signal,
          )
          continue
        }
        retained++
        retainedExact ||= token.name === tokenName
      }

      // An expired credential may still be inside the one-minute in-flight
      // grace. Never delete or replace it until that window closes.
      if (retainedExact)
        throw new Error('shared credential is awaiting safe reclamation')
      if (retained >= MAX_MANAGED_QUOTA_TOKENS)
        throw new Error('shared credential capacity is full')

      const expiresAt = tokenExpiryAt(now)
      const provisioned = await awaitDependencySettlement(
        () => dependencies.provision(
          tokenName,
          SHARED_QUOTA_PER_PERIOD,
          unixSeconds(expiresAt),
          signal,
        ),
        signal,
      )
      return cachedCredentialSchema.parse({
        tokenId: provisioned.tokenId,
        apiKey: provisioned.key,
        nextResetAt: nextResetAtMs(now),
        expiresAt,
      })
    }
    finally {
      await releaseLock(PROVISION_LOCK_KEY, owner)
      signal?.throwIfAborted()
    }
  }

  async function acquireCredential(
    identity: string,
    signal?: AbortSignal,
  ): Promise<CachedCredential> {
    signal?.throwIfAborted()
    validateIdentity(identity)
    const digest = dependencies.identityDigest(identity)
    const cacheKey = `${CACHE_PREFIX}${digest}`
    const lockKey = `${LOCK_PREFIX}${digest}`
    const cached = await readCached(cacheKey, signal)
    if (cached && isCurrent(cached, dependencies.now()))
      return cached

    const owner = dependencies.lockOwner()
    const acquired = await acquireLock(lockKey, owner, signal)
    if (!acquired) {
      signal?.throwIfAborted()
      return waitForOwner(cacheKey, signal)
    }

    try {
      signal?.throwIfAborted()
      const current = await readCached(cacheKey, signal)
      if (current && isCurrent(current, dependencies.now()))
        return current

      let next: CachedCredential
      const now = dependencies.now()
      if (current && now < current.expiresAt) {
        const expiresAt = tokenExpiryAt(now)
        await awaitDependencySettlement(
          () => dependencies.reset(
            current.tokenId,
            SHARED_QUOTA_PER_PERIOD,
            unixSeconds(expiresAt),
            signal,
          ),
          signal,
        )
        next = {
          ...current,
          nextResetAt: nextResetAtMs(now),
          expiresAt,
        }
      }
      else {
        const tokenName = tokenNameForDigest(digest)
        const recovered = await awaitDependencySettlement(
          () => dependencies.lookup(tokenName, signal),
          signal,
        )
        if (recovered) {
          next = recoveredCredential(recovered, now)
            ?? await provisionWithCapacity(tokenName, signal)
        }
        else {
          next = await provisionWithCapacity(tokenName, signal)
        }
      }

      const parsed = cachedCredentialSchema.parse(next)
      await writeCached(cacheKey, parsed, signal)
      return parsed
    }
    finally {
      await releaseLock(lockKey, owner)
      signal?.throwIfAborted()
    }
  }

  async function readQuota(identity: string, signal?: AbortSignal): Promise<SharedQuotaMetadata> {
    signal?.throwIfAborted()
    validateIdentity(identity)
    const now = dependencies.now()
    const digest = dependencies.identityDigest(identity)
    const cacheKey = `${CACHE_PREFIX}${digest}`
    let credential = await readCached(cacheKey, signal)
    if (credential && !isCurrent(credential, now))
      credential = await acquireCredential(identity, signal)
    if (!credential) {
      const recovered = await awaitDependencySettlement(
        () => dependencies.lookup(tokenNameForDigest(digest), signal),
        signal,
      )
      if (recovered) {
        credential = recoveredCredential(recovered, dependencies.now())
        if (credential)
          await writeCached(cacheKey, credential, signal)
      }
    }
    if (!credential) {
      return {
        nextResetAt: nextResetAtMs(now),
        perPeriod: SHARED_QUOTA_PER_PERIOD,
        available: SHARED_QUOTA_PER_PERIOD,
        exhausted: false,
      }
    }

    const detail = tokenDetailSchema.parse(await awaitDependencySettlement(
      () => dependencies.detail(credential.tokenId, signal),
      signal,
    ))
    if (
      detail.status !== TOKEN_STATUS_ENABLED
      && detail.status !== TOKEN_STATUS_EXHAUSTED
    ) {
      throw new Error('shared quota token is unavailable')
    }
    const available = Number.isFinite(detail.remain_quota)
      ? Math.max(0, Math.min(SHARED_QUOTA_PER_PERIOD, detail.remain_quota))
      : 0
    return {
      nextResetAt: credential.nextResetAt,
      perPeriod: SHARED_QUOTA_PER_PERIOD,
      available,
      exhausted: detail.status === TOKEN_STATUS_EXHAUSTED || available <= 0,
    }
  }

  return { acquireCredential, readQuota }
}

let defaultBroker: SharedQuotaBroker | null = null

export function getSharedQuotaBroker(): SharedQuotaBroker {
  if (!defaultBroker) {
    defaultBroker = createSharedQuotaBroker({
      redis: {
        get: (key, signal) => getRedis(signal).get(key),
        set: (key, value, options, signal) => options.nx
          ? getRedis(signal).set(key, value, { nx: true, ex: options.ex })
          : getRedis(signal).set(key, value, { ex: options.ex }),
        eval: (script, keys, args, signal) =>
          getRedis(signal).eval(script, keys, args),
      },
      lookup: async (name, signal) => {
        const tokenId = await findTokenIdByName(name, signal)
        if (tokenId === null)
          return null
        const detail = await fetchTokenDetail(tokenId, signal)
        if (
          detail.status !== TOKEN_STATUS_ENABLED
          && detail.status !== TOKEN_STATUS_EXHAUSTED
          && detail.status !== TOKEN_STATUS_EXPIRED
        ) {
          throw new Error('shared quota token is unavailable')
        }
        return {
          tokenId,
          key: await fetchTokenKey(tokenId, signal),
          expiresAt: detail.expired_time === -1
            ? Number.MAX_SAFE_INTEGER
            : detail.expired_time * 1_000,
        }
      },
      provision: provisionQuotaToken,
      reset: resetTokenRemainQuota,
      detail: fetchTokenDetail,
      listManaged: listManagedQuotaTokens,
      remove: deleteQuotaToken,
      now: Date.now,
      sleep: milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
      lockOwner: randomUUID,
      identityDigest: identity => createHash('sha256').update(identity).digest('hex'),
    })
  }
  return defaultBroker
}
