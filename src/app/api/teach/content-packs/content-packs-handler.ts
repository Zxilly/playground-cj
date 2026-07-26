import type { ContentPackLanguage } from '@/lib/teach/classroom/content-packs'
import {
  contentPacksResponseSchema,
  validateContentPack,
} from '@/lib/teach/classroom/content-packs'

type ContentPackLoader = (lang: ContentPackLanguage) => Promise<unknown>

interface ErrorLogger {
  error: (...data: unknown[]) => void
}

const RESPONSE_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
}

export function createContentPacksHandler(
  load: ContentPackLoader,
  logger: ErrorLogger = console,
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const lang = new URL(request.url).searchParams.get('lang')
    if (lang !== 'zh' && lang !== 'en') {
      return Response.json(
        { error: 'lang must be either zh or en' },
        { status: 400, headers: RESPONSE_HEADERS },
      )
    }

    try {
      const loaded = contentPacksResponseSchema.parse(await load(lang))
      if (loaded.packs.length === 0)
        throw new Error('Content Pack build produced an empty curriculum')
      for (const [index, pack] of loaded.packs.entries()) {
        const validation = validateContentPack(pack)
        if (validation.status === 'invalid') {
          throw new Error(
            `Content Pack ${index} failed validation: ${validation.issues.join('; ')}`,
          )
        }
      }
      return Response.json(loaded, { headers: RESPONSE_HEADERS })
    }
    catch (error) {
      logger.error('Failed to serve repository-reviewed Course Content Packs', error)
      return Response.json(
        { error: 'Course Content Packs are unavailable' },
        { status: 500, headers: RESPONSE_HEADERS },
      )
    }
  }
}
