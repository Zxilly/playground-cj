import type {
  ContentPackLanguage,
  ContentPacksResponse,
} from './content-packs'
import type { ContentPackCatalog } from './content-catalog'
import { createContentPackCatalog } from './content-catalog'
import { CURRENT_COURSE_CONCEPT_IDS } from './course-definition'
import enArtifact from './generated/content-packs/en.json'
import zhArtifact from './generated/content-packs/zh.json'

function compileBuiltInCourse(
  artifact: unknown,
): ContentPacksResponse {
  return artifact as ContentPacksResponse
}

export const BUILT_IN_COURSE_MAINLINE_CONCEPT_IDS = CURRENT_COURSE_CONCEPT_IDS

/**
 * Curriculum compiled into the application bundle. There is no runtime course
 * service, deployment configuration, or secondary publication log; `prebuild`
 * regenerates these modules before Next.js includes them in the client build.
 */
export const BUILT_IN_COURSE_CONTENT_PACKS: Record<
  ContentPackLanguage,
  ContentPacksResponse
> = {
  en: compileBuiltInCourse(enArtifact),
  zh: compileBuiltInCourse(zhArtifact),
}

export const BUILT_IN_COURSE_VERSION
  = BUILT_IN_COURSE_CONTENT_PACKS.en.courseVersion

export function createBuiltInCourseContentPackCatalog(
  selectedLocale: ContentPackLanguage,
): ContentPackCatalog {
  const catalog = createContentPackCatalog(
    BUILT_IN_COURSE_CONTENT_PACKS[selectedLocale].packs,
    BUILT_IN_COURSE_CONTENT_PACKS[selectedLocale === 'en' ? 'zh' : 'en'].packs,
  )
  for (const conceptId of BUILT_IN_COURSE_MAINLINE_CONCEPT_IDS)
    catalog.require(conceptId)
  return catalog
}
