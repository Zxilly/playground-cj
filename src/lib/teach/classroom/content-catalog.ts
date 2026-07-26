import type { CourseContentPack, ExerciseTemplate } from './content-packs'
import { validateContentPack } from './content-packs'

export interface ContentPackSummary {
  conceptId: string
  title: string
  version: string
  availability: 'validated' | 'read_only'
  availabilityReason: 'editorial_review' | 'prerequisite_graph_invalid' | null
}

export interface ContentPackCatalog {
  /** Explicitly designated current Content Version for every Concept. */
  list: () => ContentPackSummary[]
  /** Explicitly designated current Content Version for one Concept. */
  get: (conceptId: string) => CourseContentPack | undefined
  /** Exact historical Content Version; never substitutes latest. */
  getVersion: (conceptId: string, version: string) => CourseContentPack | undefined
  listVersions: (conceptId: string) => string[]
  availability: (
    conceptId: string,
    version?: string,
  ) => ContentPackSummary['availability'] | undefined
  requireValidated: (conceptId: string) => CourseContentPack
  requireValidatedVersion: (conceptId: string, version: string) => CourseContentPack
  requireTemplate: (
    conceptId: string,
    templateId: string,
    contentVersion: string,
  ) => ExerciseTemplate
}

interface CatalogEntry {
  availability: ContentPackSummary['availability']
  availabilityReason: ContentPackSummary['availabilityReason']
  pack: CourseContentPack
}

/**
 * Build the runtime catalog and fail closed on invalid material. Multiple
 * Content Versions for the same Concept are retained so Live View and Evidence
 * provenance can be checked against the exact historical pack.
 */
export function createContentPackCatalog(
  inputs: unknown[],
  currentVersions?: Readonly<Record<string, string>>,
): ContentPackCatalog {
  const concepts = new Map<string, Map<string, CatalogEntry>>()

  for (const input of inputs) {
    const validation = validateContentPack(input)
    if (validation.status === 'invalid')
      throw new Error(`Content Pack Validation failed: ${validation.issues.join('; ')}`)

    const pack = validation.pack
    let versions = concepts.get(pack.concept.id)
    if (!versions) {
      versions = new Map()
      concepts.set(pack.concept.id, versions)
    }
    const existingVersion = versions.get(pack.version)
    if (existingVersion) {
      throw new Error(
        `Content Pack Validation failed: duplicate Concept Version ${pack.concept.id}@${pack.version}`,
      )
    }
    const first = versions.values().next().value as CatalogEntry | undefined
    if (first && first.pack.id !== pack.id) {
      throw new Error(
        `Content Pack Validation failed: Concept ${pack.concept.id} changed pack id`,
      )
    }
    versions.set(pack.version, {
      availability: validation.status,
      availabilityReason: validation.status === 'validated'
        ? null
        : 'editorial_review',
      pack,
    })
  }

  for (const conceptId of Object.keys(currentVersions ?? {})) {
    if (!concepts.has(conceptId)) {
      throw new Error(
        `Content Pack Validation failed: current version references absent Concept ${conceptId}`,
      )
    }
  }

  const currentByConcept = new Map<string, CatalogEntry>()
  for (const [conceptId, versions] of concepts) {
    const selectedVersion = currentVersions?.[conceptId]
    if (selectedVersion) {
      const selected = versions.get(selectedVersion)
      if (!selected) {
        throw new Error(
          `Content Pack Validation failed: current Concept Version ${conceptId}@${selectedVersion} is absent`,
        )
      }
      currentByConcept.set(conceptId, selected)
      continue
    }

    if (currentVersions !== undefined) {
      throw new Error(
        `Content Pack Validation failed: Concept ${conceptId} is missing an explicit current version`,
      )
    }

    if (versions.size !== 1) {
      throw new Error(
        `Content Pack Validation failed: multiple versions of ${conceptId} require an explicit current version`,
      )
    }
    currentByConcept.set(
      conceptId,
      versions.values().next().value as CatalogEntry,
    )
  }

  // Mainline availability is a graph property, not just a per-file review
  // flag. Resolve the current validated graph from roots outward. Missing,
  // read-only, and cyclic prerequisite chains never reach the resolved set and
  // are downgraded before any Track can select them.
  const graphCandidates = new Set(
    [...currentByConcept.entries()]
      .filter(([, entry]) => entry.availability === 'validated')
      .map(([conceptId]) => conceptId),
  )
  const resolvedConcepts = new Set<string>()
  let advanced = true
  while (advanced) {
    advanced = false
    for (const conceptId of graphCandidates) {
      if (resolvedConcepts.has(conceptId))
        continue
      const entry = currentByConcept.get(conceptId)!
      if (entry.pack.concept.prerequisites.every(prerequisite =>
        graphCandidates.has(prerequisite)
        && resolvedConcepts.has(prerequisite))) {
        resolvedConcepts.add(conceptId)
        advanced = true
      }
    }
  }
  for (const conceptId of graphCandidates) {
    if (resolvedConcepts.has(conceptId))
      continue
    const entry = currentByConcept.get(conceptId)!
    entry.availability = 'read_only'
    entry.availabilityReason = 'prerequisite_graph_invalid'
  }

  const versionsFor = (conceptId: string): CatalogEntry[] => {
    const versions = concepts.get(conceptId)
    const current = currentByConcept.get(conceptId)
    if (!versions)
      return []
    if (!current)
      return [...versions.values()]
    return [
      current,
      ...[...versions.values()].filter(entry => entry !== current),
    ]
  }

  const current = (conceptId: string): CatalogEntry | undefined =>
    currentByConcept.get(conceptId)

  function requireValidatedVersion(
    conceptId: string,
    version: string,
  ): CourseContentPack {
    const entry = concepts.get(conceptId)?.get(version)
    if (!entry || entry.availability !== 'validated') {
      throw new Error(
        `${conceptId}@${version} is not a Validated Concept Version`,
      )
    }
    return entry.pack
  }

  function requireValidated(conceptId: string): CourseContentPack {
    const entry = current(conceptId)
    if (!entry || entry.availability !== 'validated')
      throw new Error(`${conceptId} is not a Validated Concept`)
    return entry.pack
  }

  return {
    list: () => [...currentByConcept.entries()].map(([conceptId, entry]) => {
      return {
        conceptId,
        title: entry.pack.concept.title,
        version: entry.pack.version,
        availability: entry.availability,
        availabilityReason: entry.availabilityReason,
      }
    }),
    get: conceptId => current(conceptId)?.pack,
    getVersion: (conceptId, version) => concepts.get(conceptId)?.get(version)?.pack,
    listVersions: conceptId => versionsFor(conceptId).map(entry => entry.pack.version),
    availability: (conceptId, version) => version === undefined
      ? current(conceptId)?.availability
      : concepts.get(conceptId)?.get(version)?.availability,
    requireValidated,
    requireValidatedVersion,
    requireTemplate: (conceptId, templateId, contentVersion) => {
      const pack = requireValidatedVersion(conceptId, contentVersion)
      const template = pack.exerciseTemplates.find(candidate => candidate.id === templateId)
      if (!template) {
        throw new Error(
          `Validated Concept ${conceptId}@${pack.version} has no Exercise Template ${templateId}`,
        )
      }
      return template
    },
  }
}
