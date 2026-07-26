import { describe, expect, it } from 'vitest'
import { classroomSnapshotSchema, createEmptyClassroom } from './state'
import { deriveConceptProgress } from './progress'
import type { CourseContentPack } from './content-packs'

const immutablePack: CourseContentPack = {
  id: 'pack:cj.var.immutable',
  version: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  learningContractVersion: `lc:sha256:${'b'.repeat(64)}`,
  concept: {
    id: 'cj.var.immutable',
    title: '不可变绑定 let',
    summary: 'let 绑定初始化后不能重新赋值。',
    prerequisites: [],
  },
  blocks: [{
    id: 'block:let',
    type: 'prose',
    markdown: '`let` 创建不可变绑定。',
    sourceReferences: [{
      sourceId: 'static-tour',
      ref: '02-basics/01-bindings/01',
      title: 'let（不可变绑定）',
    }],
  }],
  learningSkills: [{
    id: 'skill:let:declare',
    conceptId: 'cj.var.immutable',
    title: '声明不可变绑定',
    description: '能声明并使用 let 绑定。',
    key: true,
  }],
  exerciseTemplates: [{
    id: 'template:let:practice',
    version: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    learningSkillId: 'skill:let:declare',
    purpose: 'practice',
    task: {
      type: 'code_output',
      prompt: '声明一个不可变绑定并打印它。',
      starterCode: 'main() {}',
      expectedOutput: '42',
      matchMode: 'exact',
      sourceRequirements: [{ type: 'top_level_main' }],
      hints: [],
    },
  }],
  review: {
    status: 'approved',
    reviewedBy: 'external-review-attestation:test-key:0000000000000000000000000000000000000000000000000000000000000000',
  },
}

describe('concept progress', () => {
  it('orders consecutive failures by committed Attempt revision when the wall clock moves backward', () => {
    const snapshot = createEmptyClassroom()
    const outcomes = ['success', 'failure', 'failure', 'failure'] as const
    for (const [index, outcome] of outcomes.entries()) {
      const sequence = index + 1
      const attemptId = `attempt:${sequence}`
      const createdAt = 110 - sequence * 10
      snapshot.attempts.push({
        id: attemptId,
        exerciseInstanceId: 'exercise:1',
        assistanceEventIds: [],
        teacherExposureEpochId: null,
        submission: {
          type: 'code_output',
          code: 'main() {}',
        },
        result: {
          passed: outcome === 'success',
        },
        assistance: 'none',
        createdAt,
        recordedRevision: sequence,
      })
      snapshot.evidence.push({
        id: `evidence:${sequence}`,
        type: 'independent',
        outcome,
        conceptId: immutablePack.concept.id,
        learningSkillId: 'skill:let:declare',
        contentVersion: immutablePack.version,
        learningContractVersion: immutablePack.learningContractVersion,
        templateId: 'template:let:practice',
        templateVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        exerciseInstanceId: 'exercise:1',
        attemptId,
        createdAt,
      })
    }

    expect(deriveConceptProgress(snapshot, immutablePack)).toBe('blocked')
  })

  it('rejects fabricated self-report records instead of preserving a dead evidence branch', () => {
    const forged = {
      ...createEmptyClassroom(),
      evidence: [{
        id: 'evidence:1',
        type: 'self_report',
        outcome: 'success',
        conceptId: immutablePack.concept.id,
        learningSkillId: 'skill:let:declare',
        contentVersion: immutablePack.version,
        learningContractVersion: immutablePack.learningContractVersion,
        createdAt: 200,
      }],
    }

    expect(classroomSnapshotSchema.safeParse(forged).success).toBe(false)
  })

  it('reports a current blocker even when an older content version had success', () => {
    const snapshot = createEmptyClassroom()
    snapshot.evidence.push({
      id: 'evidence:old-success',
      type: 'independent',
      outcome: 'success',
      conceptId: immutablePack.concept.id,
      learningSkillId: 'skill:let:declare',
      contentVersion: 'cv:sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      learningContractVersion: immutablePack.learningContractVersion,
      createdAt: 10,
    })
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      snapshot.evidence.push({
        id: `evidence:failure:${attempt}`,
        type: 'independent',
        outcome: 'failure',
        conceptId: immutablePack.concept.id,
        learningSkillId: 'skill:let:declare',
        contentVersion: immutablePack.version,
        learningContractVersion: immutablePack.learningContractVersion,
        createdAt: 10 + attempt,
      })
    }

    expect(deriveConceptProgress(snapshot, immutablePack)).toBe('blocked')
  })

  it('keeps equivalent evidence current across localized Content Versions', () => {
    const snapshot = createEmptyClassroom()
    snapshot.evidence.push({
      id: 'evidence:english-success',
      type: 'independent',
      outcome: 'success',
      conceptId: immutablePack.concept.id,
      learningSkillId: 'skill:let:declare',
      contentVersion: 'cv:sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      learningContractVersion: immutablePack.learningContractVersion,
      createdAt: 10,
    })

    expect(deriveConceptProgress(snapshot, immutablePack)).toBe('demonstrated')
  })

  it('marks success stale when the learning contract changes', () => {
    const snapshot = createEmptyClassroom()
    snapshot.evidence.push({
      id: 'evidence:old-contract-success',
      type: 'independent',
      outcome: 'success',
      conceptId: immutablePack.concept.id,
      learningSkillId: 'skill:let:declare',
      contentVersion: immutablePack.version,
      learningContractVersion: `lc:sha256:${'c'.repeat(64)}`,
      createdAt: 10,
    })

    expect(deriveConceptProgress(snapshot, immutablePack)).toBe('stale')
  })
})
