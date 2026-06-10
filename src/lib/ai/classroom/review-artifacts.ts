import type { LearningEvidence, ReviewArtifact, ReviewArtifactKind } from './types'

export interface RetainedItemControlState {
  artifactId: string
  kind: ReviewArtifactKind
  title: string
  removable: true
  removed: false
  removalEffect: 'review_content_and_personalization_index'
  preservesEvidence: boolean
}

export interface ReviewArtifactGroup {
  groupId: string
  conceptId: string
  kind: 'clarification_group' | 'remediation_pattern'
  title: string
  summary: string
  body: string
  artifactIds: string[]
  evidenceIds: string[]
  skillId?: string
  artifactCount: number
  createdAt: number
  updatedAt: number
  controls: RetainedItemControlState[]
}

export interface ConceptReviewArtifactGroup {
  conceptId: string
  clarifications: ReviewArtifactGroup[]
  remediations: ReviewArtifactGroup[]
  controls: RetainedItemControlState[]
}

function activeArtifacts(artifacts: ReviewArtifact[]): ReviewArtifact[] {
  return artifacts.filter(artifact => artifact.removedAt == null)
}

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ')
}

function groupKeyForClarification(artifact: ReviewArtifact): string {
  const titleKey = normalizeKey(artifact.title)
  const summaryKey = normalizeKey(artifact.summary)
  return titleKey || summaryKey || artifact.kind
}

function evidenceById(evidence: LearningEvidence[]): Map<string, LearningEvidence> {
  return new Map(evidence.map(item => [item.evidenceId, item]))
}

function evidencePatternKey(artifact: ReviewArtifact, evidence: Map<string, LearningEvidence>): string {
  const linkedEvidence = artifact.evidenceIds
    .map(id => evidence.get(id))
    .filter(item => item != null)
  const linkedSummaries = linkedEvidence.map(item => item.summary).join(' ')
  const patternText = normalizeKey(linkedSummaries || artifact.summary || artifact.title)
  return `${artifact.skillId ?? 'concept'}:${patternText}`
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function controlForArtifact(artifact: ReviewArtifact): RetainedItemControlState {
  return {
    artifactId: artifact.artifactId,
    kind: artifact.kind,
    title: artifact.title,
    removable: true,
    removed: false,
    removalEffect: 'review_content_and_personalization_index',
    preservesEvidence: artifact.evidenceIds.length > 0,
  }
}

function mergeBody(artifacts: ReviewArtifact[]): string {
  return uniqueValues(artifacts.map(artifact => artifact.body.trim())).join('\n\n')
}

function groupFromArtifacts(
  conceptId: string,
  kind: ReviewArtifactGroup['kind'],
  groupKey: string,
  artifacts: ReviewArtifact[],
): ReviewArtifactGroup {
  const ordered = [...artifacts].sort((a, b) => a.createdAt - b.createdAt || a.artifactId.localeCompare(b.artifactId))
  const latest = ordered[ordered.length - 1]
  const evidenceIds = uniqueValues(ordered.flatMap(artifact => artifact.evidenceIds)).sort()
  const artifactIds = ordered.map(artifact => artifact.artifactId)
  return {
    groupId: `${conceptId}:${kind}:${groupKey}`,
    conceptId,
    kind,
    title: latest.title,
    summary: uniqueValues(ordered.map(artifact => artifact.summary)).join(' / '),
    body: mergeBody(ordered),
    artifactIds,
    evidenceIds,
    skillId: latest.skillId,
    artifactCount: ordered.length,
    createdAt: ordered[0].createdAt,
    updatedAt: latest.createdAt,
    controls: ordered.map(controlForArtifact),
  }
}

function groupedValues(groups: Map<string, ReviewArtifact[]>): Array<[string, ReviewArtifact[]]> {
  return [...groups.entries()].sort((a, b) => {
    const aTime = Math.min(...a[1].map(artifact => artifact.createdAt))
    const bTime = Math.min(...b[1].map(artifact => artifact.createdAt))
    return aTime - bTime || a[0].localeCompare(b[0])
  })
}

export function groupActiveReviewArtifactsByConcept(
  artifacts: ReviewArtifact[],
  evidence: LearningEvidence[] = [],
): Map<string, ConceptReviewArtifactGroup> {
  const evidenceIndex = evidenceById(evidence)
  const byConcept = new Map<string, ReviewArtifact[]>()
  for (const artifact of activeArtifacts(artifacts))
    byConcept.set(artifact.conceptId, [...(byConcept.get(artifact.conceptId) ?? []), artifact])

  const out = new Map<string, ConceptReviewArtifactGroup>()
  for (const [conceptId, conceptArtifacts] of byConcept.entries()) {
    const clarificationGroups = new Map<string, ReviewArtifact[]>()
    const remediationGroups = new Map<string, ReviewArtifact[]>()

    for (const artifact of conceptArtifacts) {
      if (artifact.kind === 'remediation') {
        const key = evidencePatternKey(artifact, evidenceIndex)
        remediationGroups.set(key, [...(remediationGroups.get(key) ?? []), artifact])
      }
      else {
        const key = `${artifact.kind}:${groupKeyForClarification(artifact)}`
        clarificationGroups.set(key, [...(clarificationGroups.get(key) ?? []), artifact])
      }
    }

    const clarifications = groupedValues(clarificationGroups)
      .map(([key, items]) => groupFromArtifacts(conceptId, 'clarification_group', key, items))
    const remediations = groupedValues(remediationGroups)
      .map(([key, items]) => groupFromArtifacts(conceptId, 'remediation_pattern', key, items))
    const controls = [...clarifications, ...remediations].flatMap(group => group.controls)

    out.set(conceptId, {
      conceptId,
      clarifications,
      remediations,
      controls,
    })
  }
  return out
}

export function retainedItemControlsForConcept(
  artifacts: ReviewArtifact[],
  conceptId: string,
): RetainedItemControlState[] {
  return activeArtifacts(artifacts)
    .filter(artifact => artifact.conceptId === conceptId)
    .sort((a, b) => a.createdAt - b.createdAt || a.artifactId.localeCompare(b.artifactId))
    .map(controlForArtifact)
}
