import type { ContentPackCache } from './content-pack-cache'
import type { ContentPackCatalog } from './content-catalog'
import type {
  ContentPacksResponse,
  CourseContentPack,
} from './content-packs'
import { createIndexedDBContentPackCache } from './content-pack-cache'
import { createContentPackCatalog } from './content-catalog'
import { contentPacksResponseSchema } from './content-packs'

export type ContentPackLocale = 'en' | 'zh'

export interface CourseContentPackRepository {
  open: (
    selectedLocale: ContentPackLocale,
    options?: { signal?: AbortSignal },
  ) => Promise<ContentPackCatalog>
  close: () => Promise<void>
}

export interface CourseContentPackRepositoryOptions {
  fetch?: typeof fetch
}

async function fetchLocale(
  locale: ContentPackLocale,
  request: typeof fetch,
  signal: AbortSignal | undefined,
): Promise<ContentPacksResponse> {
  const response = await request(
    `/api/teach/content-packs?lang=${encodeURIComponent(locale)}`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    },
  )
  if (!response.ok) {
    throw new Error(
      `Course Content Pack request failed with status ${response.status}`,
    )
  }
  return contentPacksResponseSchema.parse(await response.json())
}

function requireSettled<T>(
  result: PromiseSettledResult<T>,
): T {
  if (result.status === 'rejected')
    throw result.reason
  return result.value
}

async function closeCaches(caches: readonly ContentPackCache[]): Promise<void> {
  const results = await Promise.allSettled(caches.map(cache => cache.close()))
  const failures = results
    .filter((result): result is PromiseRejectedResult =>
      result.status === 'rejected')
    .map(result => result.reason)
  if (failures.length === 1)
    throw failures[0]
  if (failures.length > 1) {
    throw new AggregateError(
      failures,
      'Failed to close Course Content Pack repository',
    )
  }
}

/**
 * Owns the complete bilingual Course Content Pack lifecycle. Callers receive a
 * ready catalog and do not coordinate locale fetches, immutable cache merges,
 * current-version selection, or cache ownership themselves.
 */
export function createCourseContentPackRepository(
  options: CourseContentPackRepositoryOptions = {},
): CourseContentPackRepository {
  const request = options.fetch ?? fetch
  const caches: Record<ContentPackLocale, ContentPackCache> = {
    en: createIndexedDBContentPackCache({ locale: 'en' }),
    zh: createIndexedDBContentPackCache({ locale: 'zh' }),
  }
  let opened = false
  let closed = false
  let opening: Promise<ContentPackCatalog> | undefined
  let closing: Promise<void> | undefined

  async function load(
    selectedLocale: ContentPackLocale,
    signal: AbortSignal | undefined,
  ): Promise<ContentPackCatalog> {
    const [englishResponseResult, chineseResponseResult]
      = await Promise.allSettled([
        fetchLocale('en', request, signal),
        fetchLocale('zh', request, signal),
      ])
    const responses = {
      en: requireSettled(englishResponseResult),
      zh: requireSettled(chineseResponseResult),
    }

    const [englishPacksResult, chinesePacksResult]
      = await Promise.allSettled([
        caches.en.merge(responses.en),
        caches.zh.merge(responses.zh),
      ])
    const packs: Record<ContentPackLocale, CourseContentPack[]> = {
      en: requireSettled(englishPacksResult),
      zh: requireSettled(chinesePacksResult),
    }
    if (closed)
      throw new Error('Course Content Pack repository closed while opening')

    return createContentPackCatalog(
      [...packs.en, ...packs.zh],
      responses[selectedLocale].currentVersions,
    )
  }

  return {
    open(selectedLocale, openOptions = {}) {
      if (closed)
        return Promise.reject(new Error('Course Content Pack repository is closed'))
      if (opened || opening) {
        return Promise.reject(
          new Error('Course Content Pack repository can only be opened once'),
        )
      }
      opened = true
      opening = load(selectedLocale, openOptions.signal)
      return opening
    },
    close() {
      closing ??= (async () => {
        closed = true
        await opening?.catch(() => undefined)
        await closeCaches([caches.en, caches.zh])
      })()
      return closing
    },
  }
}
