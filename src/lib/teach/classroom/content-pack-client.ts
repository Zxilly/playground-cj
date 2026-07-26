import type { ContentPacksResponse } from './content-packs'
import { contentPacksResponseSchema } from './content-packs'

export interface ContentPackClientOptions {
  signal?: AbortSignal
  fetch?: typeof fetch
}

/** Load the entire validated/read-only catalog; malformed responses fail closed. */
export async function fetchCourseContentPacks(
  lang: 'zh' | 'en',
  options: ContentPackClientOptions = {},
): Promise<ContentPacksResponse> {
  const request = options.fetch ?? fetch
  const response = await request(
    `/api/teach/content-packs?lang=${encodeURIComponent(lang)}`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: options.signal,
    },
  )
  if (!response.ok)
    throw new Error(`Course Content Pack request failed with status ${response.status}`)
  return contentPacksResponseSchema.parse(await response.json())
}
