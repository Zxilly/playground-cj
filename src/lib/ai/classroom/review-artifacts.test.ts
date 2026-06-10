import { describe, expect, it } from 'vitest'
import { groupActiveReviewArtifactsByConcept } from './review-artifacts'
import type { LearningEvidence, ReviewArtifact } from './types'

describe('groupActiveReviewArtifactsByConcept', () => {
  it('merges active clarifications by concept and theme while exposing removal controls', () => {
    const artifacts: ReviewArtifact[] = [
      {
        artifactId: 'clarify-1',
        kind: 'clarification',
        conceptId: 'cj.io.println',
        title: 'Print reminder',
        body: 'Use println for stdout.',
        summary: 'println reminder',
        evidenceIds: [],
        createdAt: 1001,
      },
      {
        artifactId: 'clarify-2',
        kind: 'clarification',
        conceptId: 'cj.io.println',
        title: 'Print reminder',
        body: 'println adds a newline.',
        summary: 'println newline reminder',
        evidenceIds: [],
        createdAt: 1002,
      },
      {
        artifactId: 'removed',
        kind: 'clarification',
        conceptId: 'cj.io.println',
        title: 'Print reminder',
        body: 'hidden',
        summary: 'hidden',
        evidenceIds: [],
        createdAt: 1003,
        removedAt: 1004,
      },
    ]

    const groups = groupActiveReviewArtifactsByConcept(artifacts).get('cj.io.println')

    expect(groups?.clarifications).toEqual([
      expect.objectContaining({
        kind: 'clarification_group',
        artifactIds: ['clarify-1', 'clarify-2'],
        artifactCount: 2,
        body: 'Use println for stdout.\n\nprintln adds a newline.',
      }),
    ])
    expect(groups?.controls).toEqual([
      expect.objectContaining({
        artifactId: 'clarify-1',
        removable: true,
        removalEffect: 'review_content_and_personalization_index',
      }),
      expect.objectContaining({ artifactId: 'clarify-2' }),
    ])
  })

  it('aggregates remediations by skill and evidence pattern while preserving evidence links', () => {
    const evidence: LearningEvidence[] = [
      {
        evidenceId: 'e1',
        skillId: 'cj.io.println.print-value',
        conceptIds: ['cj.io.println'],
        outcome: 'failure',
        strength: 'independent',
        summary: 'Used print instead of println.',
        createdAt: 1001,
      },
      {
        evidenceId: 'e2',
        skillId: 'cj.io.println.print-value',
        conceptIds: ['cj.io.println'],
        outcome: 'failure',
        strength: 'independent',
        summary: 'Used print instead of println.',
        createdAt: 1002,
      },
    ]
    const artifacts: ReviewArtifact[] = [
      {
        artifactId: 'remediate-1',
        kind: 'remediation',
        conceptId: 'cj.io.println',
        skillId: 'cj.io.println.print-value',
        title: 'println mismatch',
        body: 'The expected output needs println.',
        summary: 'print vs println',
        evidenceIds: ['e1'],
        createdAt: 1003,
      },
      {
        artifactId: 'remediate-2',
        kind: 'remediation',
        conceptId: 'cj.io.println',
        skillId: 'cj.io.println.print-value',
        title: 'println mismatch again',
        body: 'Repeat pattern: stdout needs println.',
        summary: 'print vs println',
        evidenceIds: ['e2'],
        createdAt: 1004,
      },
    ]

    const groups = groupActiveReviewArtifactsByConcept(artifacts, evidence).get('cj.io.println')

    expect(groups?.remediations).toEqual([
      expect.objectContaining({
        kind: 'remediation_pattern',
        skillId: 'cj.io.println.print-value',
        artifactIds: ['remediate-1', 'remediate-2'],
        evidenceIds: ['e1', 'e2'],
        artifactCount: 2,
      }),
    ])
    expect(groups?.remediations[0].controls).toEqual([
      expect.objectContaining({ artifactId: 'remediate-1', preservesEvidence: true }),
      expect.objectContaining({ artifactId: 'remediate-2', preservesEvidence: true }),
    ])
  })
})
