import type {
  ContentPackLanguage,
  ContentPacksResponse,
  CourseContentPack,
} from './content-packs'
import type { ContentPackCatalog } from './content-catalog'
import { createContentPackCatalog } from './content-catalog'
import enArtifact from './generated/content-packs/en.json'
import publicationHistory from './generated/content-packs/publication-history.json'
import zhArtifact from './generated/content-packs/zh.json'

const publicationHead = publicationHistory.entries.at(-1)
if (!publicationHead)
  throw new Error('Built-in Course Content Pack publication history is empty')

const repositoryReview = {
  status: 'approved' as const,
  reviewedBy:
    `repository-review-declaration:${publicationHead.reviewDeclarationSha256}`,
}

function compileBuiltInCourse(
  artifact: unknown,
): ContentPacksResponse {
  // The build-time publication verifier owns schema, digest, receipt, and
  // bilingual-contract validation. This browser module only projects the
  // checked-in immutable artifact into its repository-approved representation.
  const compiled = artifact as {
    currentVersions: Record<string, string>
    packs: CourseContentPack[]
  }
  return {
    currentVersions: compiled.currentVersions,
    packs: compiled.packs.map(pack => ({
      ...pack,
      review: repositoryReview,
    })),
  }
}

/**
 * Curriculum compiled into the application bundle. There is no runtime course
 * service or deployment configuration; `prebuild` verifies these Git-tracked
 * artifacts before Next.js includes them in the client build.
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
  return createContentPackCatalog(
    [
      ...BUILT_IN_COURSE_CONTENT_PACKS.en.packs,
      ...BUILT_IN_COURSE_CONTENT_PACKS.zh.packs,
    ],
    BUILT_IN_COURSE_CONTENT_PACKS[selectedLocale].currentVersions,
  )
}
