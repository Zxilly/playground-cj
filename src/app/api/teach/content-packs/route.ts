import { loadCourseContentPacks } from '@/lib/teach/classroom/content-pack-source'
import { createContentPacksHandler } from './content-packs-handler'

export const runtime = 'nodejs'

export const GET = createContentPacksHandler(loadCourseContentPacks)
