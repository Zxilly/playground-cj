import type { DBSchema, IDBPDatabase } from 'idb'
import type {
  ContentPacksResponse,
  CourseContentPack,
} from './content-packs'
import { canonicalJson } from './canonical-json'
import { openDB } from 'idb'
import {
  contentPacksResponseSchema,
  courseContentPackSchema,
  validateContentPack,
} from './content-packs'

export const CONTENT_PACK_CACHE_DATABASE_NAME
  = 'playground-cj-ai-classroom-content-packs-v1'
const CONTENT_PACK_STORE_NAME = 'immutable-content-packs'
const LOCALE_INDEX_NAME = 'by-locale'

interface CachedContentPack {
  locale: 'zh' | 'en'
  conceptId: string
  version: string
  pack: CourseContentPack
}

interface ContentPackCacheDatabase extends DBSchema {
  [CONTENT_PACK_STORE_NAME]: {
    key: string
    value: CachedContentPack
    indexes: {
      [LOCALE_INDEX_NAME]: string
    }
  }
}

export class ContentPackVersionCollisionError extends Error {
  readonly conceptId: string
  readonly version: string

  constructor(conceptId: string, version: string) {
    super(
      `Immutable Content Pack collision for ${conceptId}@${version}`,
    )
    this.name = 'ContentPackVersionCollisionError'
    this.conceptId = conceptId
    this.version = version
  }
}

export interface ContentPackCache {
  /**
   * Atomically verifies and stores the server-designated current packs, then
   * returns them followed by every cached historical version for this locale.
   */
  merge: (response: ContentPacksResponse) => Promise<CourseContentPack[]>
  close: () => Promise<void>
}

export interface IndexedDBContentPackCacheOptions {
  locale: 'zh' | 'en'
  databaseName?: string
}

function cacheKey(
  locale: 'zh' | 'en',
  conceptId: string,
  version: string,
): string {
  return JSON.stringify([locale, conceptId, version])
}

function parseCachedRecord(
  input: CachedContentPack,
  locale: 'zh' | 'en',
): CourseContentPack {
  if (input.locale !== locale)
    throw new Error('Content Pack cache returned a record from another locale')
  const pack = courseContentPackSchema.parse(input.pack)
  const validation = validateContentPack(pack)
  if (validation.status === 'invalid') {
    throw new Error(
      `Cached Content Pack failed validation: ${validation.issues.join('; ')}`,
    )
  }
  if (
    input.conceptId !== pack.concept.id
    || input.version !== pack.version
  ) {
    throw new Error('Content Pack cache identity does not match its payload')
  }
  return pack
}

function assertCacheablePacks(response: ContentPacksResponse): void {
  for (const pack of response.packs) {
    const validation = validateContentPack(pack)
    if (validation.status === 'invalid') {
      throw new Error(
        `Content Pack failed validation before caching: ${validation.issues.join('; ')}`,
      )
    }
  }
}

/**
 * Review status is a deployment-time trust projection, not authored
 * curriculum. It may be granted or revoked for an unchanged immutable
 * Concept Version without changing that version's content identity.
 */
function immutablePackPayload(pack: CourseContentPack): unknown {
  const { review: _review, ...content } = pack
  return content
}

/**
 * Browser-owned immutable curriculum history. A Concept Version key is
 * content-write-once. Mutable external-review metadata is refreshed from the
 * latest verified server projection for the same immutable content.
 */
export function createIndexedDBContentPackCache(
  options: IndexedDBContentPackCacheOptions,
): ContentPackCache {
  const databaseName = options.databaseName ?? CONTENT_PACK_CACHE_DATABASE_NAME
  if (!databaseName.trim())
    throw new Error('IndexedDB Content Pack cache requires a database name')

  let databasePromise: Promise<IDBPDatabase<ContentPackCacheDatabase>> | null = null
  let closed = false

  function database(): Promise<IDBPDatabase<ContentPackCacheDatabase>> {
    if (closed)
      return Promise.reject(new Error('IndexedDB Content Pack cache is closed'))
    if (typeof indexedDB === 'undefined')
      return Promise.reject(new Error('IndexedDB is unavailable in this environment'))
    databasePromise ??= openDB<ContentPackCacheDatabase>(databaseName, 1, {
      upgrade(db) {
        if (db.objectStoreNames.contains(CONTENT_PACK_STORE_NAME))
          return
        const store = db.createObjectStore(CONTENT_PACK_STORE_NAME)
        store.createIndex(LOCALE_INDEX_NAME, 'locale')
      },
    })
    return databasePromise
  }

  return {
    merge: async (input) => {
      const response = contentPacksResponseSchema.parse(input)
      assertCacheablePacks(response)
      const db = await database()
      const transaction = db.transaction(CONTENT_PACK_STORE_NAME, 'readwrite')

      try {
        for (const pack of response.packs) {
          const key = cacheKey(options.locale, pack.concept.id, pack.version)
          const existing = await transaction.store.get(key)
          if (
            existing
            && canonicalJson(immutablePackPayload(
              parseCachedRecord(existing, options.locale),
            ))
            !== canonicalJson(immutablePackPayload(pack))
          ) {
            throw new ContentPackVersionCollisionError(
              pack.concept.id,
              pack.version,
            )
          }
          await transaction.store.put({
            locale: options.locale,
            conceptId: pack.concept.id,
            version: pack.version,
            pack,
          }, key)
        }

        const records = await transaction.store
          .index(LOCALE_INDEX_NAME)
          .getAll(options.locale)
        await transaction.done

        const currentIdentities = new Set(response.packs.map(pack =>
          `${pack.concept.id}\0${pack.version}`))
        const historical = records
          .map(record => parseCachedRecord(record, options.locale))
          .filter(pack =>
            !currentIdentities.has(`${pack.concept.id}\0${pack.version}`))
          .sort((left, right) =>
            left.concept.id.localeCompare(right.concept.id)
            || left.version.localeCompare(right.version))
        return [...response.packs, ...historical]
      }
      catch (error) {
        try {
          transaction.abort()
        }
        catch {
          // The transaction may already have failed or committed; preserve the
          // validation/collision error that caused this cleanup path.
        }
        await transaction.done.catch(() => undefined)
        throw error
      }
    },
    close: async () => {
      if (closed)
        return
      closed = true
      if (databasePromise)
        (await databasePromise).close()
    },
  }
}
