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
  inputs: readonly CourseContentPack[],
): ContentPackCatalog {
  const packs = new Map(inputs.map(pack => [pack.concept.id, pack]))

  const get = (
    conceptId: string,
    contentVersion?: string,
  ): CourseContentPack | undefined => {
    const pack = packs.get(conceptId)
    return pack && (contentVersion === undefined || pack.version === contentVersion)
      ? pack
      : undefined
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
    list: () => [...packs.values()].map(pack => ({
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
