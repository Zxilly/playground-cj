import type { CourseContentPack, ExerciseTemplate } from './content-packs'

export interface ContentPackSummary {
  conceptId: string
  title: string
  version: string
}

/**
 * The current Course compiled from Git. A build contains one implementation of
 * each Concept; Content Version arguments only verify persisted provenance and
 * never select an older implementation.
 */
export interface ContentPackCatalog {
  list: () => ContentPackSummary[]
  get: (
    conceptId: string,
    contentVersion?: string,
  ) => CourseContentPack | undefined
  require: (conceptId: string, contentVersion?: string) => CourseContentPack
  requireTemplate: (
    conceptId: string,
    templateId: string,
    contentVersion: string,
  ) => ExerciseTemplate
}

/** Index the current Course module already verified by the build. */
export function createContentPackCatalog(
  selectedPacks: readonly CourseContentPack[],
  translatedPacks: readonly CourseContentPack[] = [],
): ContentPackCatalog {
  const selectedByConcept = new Map(
    selectedPacks.map(pack => [pack.concept.id, pack]),
  )
  const exactByIdentity = new Map(
    [...selectedPacks, ...translatedPacks].map(pack => [
      `${pack.concept.id}\0${pack.version}`,
      pack,
    ]),
  )

  const get = (
    conceptId: string,
    contentVersion?: string,
  ): CourseContentPack | undefined => {
    return contentVersion === undefined
      ? selectedByConcept.get(conceptId)
      : exactByIdentity.get(`${conceptId}\0${contentVersion}`)
  }

  const require = (
    conceptId: string,
    contentVersion?: string,
  ): CourseContentPack => {
    const pack = get(conceptId, contentVersion)
    if (!pack) {
      const identity = contentVersion
        ? `${conceptId}@${contentVersion}`
        : conceptId
      throw new Error(`${identity} is not in the current Course`)
    }
    return pack
  }

  return {
    list: () => [...selectedByConcept.values()].map(pack => ({
      conceptId: pack.concept.id,
      title: pack.concept.title,
      version: pack.version,
    })),
    get,
    require,
    requireTemplate: (conceptId, templateId, contentVersion) => {
      const pack = require(conceptId, contentVersion)
      const template = pack.exerciseTemplates.find(candidate =>
        candidate.id === templateId)
      if (!template) {
        throw new Error(
          `Current Course ${conceptId}@${pack.version} has no Exercise Template ${templateId}`,
        )
      }
      return template
    },
  }
}
