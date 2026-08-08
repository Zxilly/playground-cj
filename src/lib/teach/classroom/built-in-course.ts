import type {
  ContentPackLanguage,
  ContentPacksResponse,
} from './content-packs'
import type { ContentPackCatalog } from './content-catalog'
import { createContentPackCatalog } from './content-catalog'
import enArtifact from './generated/content-packs/en.json'
import zhArtifact from './generated/content-packs/zh.json'

function compileBuiltInCourse(
  artifact: unknown,
): ContentPacksResponse {
  return artifact as ContentPacksResponse
}

export const BUILT_IN_COURSE_MAINLINE_CONCEPT_IDS = [
  'cj.program.main',
  'cj.io.println',
  'cj.var.immutable',
  'cj.var.mutable',
] as const

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

export function createBuiltInCourseContentPackCatalog(
  selectedLocale: ContentPackLanguage,
): ContentPackCatalog {
  const catalog = createContentPackCatalog(
    [
      ...BUILT_IN_COURSE_CONTENT_PACKS.en.packs,
      ...BUILT_IN_COURSE_CONTENT_PACKS.zh.packs,
    ],
    BUILT_IN_COURSE_CONTENT_PACKS[selectedLocale].currentVersions,
  )
  for (const conceptId of BUILT_IN_COURSE_MAINLINE_CONCEPT_IDS)
    catalog.requireValidated(conceptId)
  return catalog
}
