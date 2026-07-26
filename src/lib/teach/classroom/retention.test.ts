import type { ReviewArtifact } from './state'
import { describe, expect, it } from 'vitest'
import {
  clarificationSuppressionKey,
  groupReviewArtifacts,
  remediationReviewGroupKey,
  remediationSuppressionKey,
} from './retention'

function remediation(
  id: string,
  theme: string,
  updatedAt: number,
  updatedRevision = Math.max(1, updatedAt),
): ReviewArtifact {
  return {
    id,
    type: 'remediation',
    conceptId: 'cj.var.immutable',
    learningSkillId: 'skill:let',
    diagnosticStatus: 'ready',
    diagnosticAttempts: 0,
    diagnosticFailure: null,
    nextDiagnosticAttemptAt: null,
    diagnosticClaim: null,
    misconceptionTheme: theme,
    markdown: `Diagnostic ${id}`,
    attemptIds: [`attempt:${id}`],
    evidenceIds: [`evidence:${id}`],
    createdAt: 1,
    updatedAt,
    createdRevision: 1,
    updatedRevision,
  }
}

describe('review artifact grouping', () => {
  it('aggregates normalized Remediation themes but preserves every lineage', () => {
    const first = remediation('first', ' Reassignment! ', 10)
    const latest = remediation('latest', 'reassignment', 20)
    const other = remediation('other', 'declaration', 30)

    const groups = groupReviewArtifacts([first, latest, other], {
      learningContractVersionFor: () => 'lc:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })

    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({
      artifacts: [first, latest],
      representative: latest,
    })
    expect(groups[1]).toMatchObject({
      artifacts: [other],
      representative: other,
    })
  })

  it('selects the representative by revision when timestamps are equal', () => {
    const earlier = remediation('earlier', 'reassignment', 10, 2)
    const later = remediation('later', 'reassignment', 10, 3)

    expect(groupReviewArtifacts([earlier, later], {
      learningContractVersionFor: () => 'lc:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })[0]?.representative).toBe(later)
  })

  it('never merges one misconception theme across Learning Contracts', () => {
    const oldContract = remediation('old', 'reassignment', 10)
    const currentContract = remediation('current', 'reassignment', 20)

    const groups = groupReviewArtifacts([oldContract, currentContract], {
      learningContractVersionFor: artifact =>
        artifact.id === oldContract.id ? 'lc:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' : 'lc:sha256:3333333333333333333333333333333333333333333333333333333333333333',
    })

    expect(groups).toHaveLength(2)
    expect(groups.map(group => group.learningContractVersion)).toEqual([
      'lc:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'lc:sha256:3333333333333333333333333333333333333333333333333333333333333333',
    ])
    expect(groups.map(group => group.artifacts)).toEqual([
      [oldContract],
      [currentContract],
    ])
  })

  it('uses collision-free structural identities instead of delimiter concatenation', () => {
    expect(
      remediationReviewGroupKey('a:b', 'c', 'same'),
    ).not.toBe(
      remediationReviewGroupKey('a', 'b:c', 'same'),
    )
    expect(
      remediationSuppressionKey('concept', 'skill', ['a,b', 'c']),
    ).not.toBe(
      remediationSuppressionKey('concept', 'skill', ['a', 'b,c']),
    )
    expect(
      clarificationSuppressionKey('a:b', 'c', 'same'),
    ).not.toBe(
      clarificationSuppressionKey('a', 'b:c', 'same'),
    )
  })
})
