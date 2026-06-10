import { describe, expect, it } from 'vitest'
import { createCourseContentIndex, getDefaultCourseContentIndex, getDefaultCourseContentPack } from '@/lib/ai/course-content/loader'
import {
  assertTemplateBackedByValidatedConcepts,
  planContentReferenceGroup,
  planSkipMarker,
  requireUsableCourseConcept,
} from './tutoring-step-planning'

describe('tutoring step planning', () => {
  it('orders selected content references by Course Content Pack order', () => {
    const index = getDefaultCourseContentIndex()

    const planned = planContentReferenceGroup(index, {
      conceptId: 'cj.var.immutable',
      blockIds: ['cj.var.immutable.example', 'cj.var.immutable.heading'],
      skillId: 'cj.var.immutable.choose-let',
    })

    expect(planned.blockIds).toEqual([
      'cj.var.immutable.heading',
      'cj.var.immutable.example',
    ])
  })

  it('rejects mainline steps for read-only concepts', () => {
    const pack = structuredClone(getDefaultCourseContentPack())
    pack.concepts[0] = { ...pack.concepts[0], skillIds: [] }
    pack.skills = pack.skills.filter(skill => !skill.conceptIds.includes(pack.concepts[0].conceptId))
    pack.exerciseTemplates = pack.exerciseTemplates.filter(template => !template.conceptIds.includes(pack.concepts[0].conceptId))
    pack.tracks = pack.tracks.map(track => ({
      ...track,
      skillIds: track.skillIds.filter(skillId => skillId !== 'cj.program.main.write-entry'),
    }))
    const index = createCourseContentIndex(pack)

    expect(() => requireUsableCourseConcept(index, pack.concepts[0].conceptId, true))
      .toThrow('mainline orchestration requires a Validated Concept')
  })

  it('rejects blocks that do not belong to the requested concept', () => {
    const index = getDefaultCourseContentIndex()

    expect(() => planContentReferenceGroup(index, {
      conceptId: 'cj.var.immutable',
      blockIds: ['cj.io.println.heading'],
    })).toThrow('not linked to concept "cj.var.immutable"')
  })

  it('validates and orders skip marker block ids', () => {
    const index = getDefaultCourseContentIndex()

    const planned = planSkipMarker(index, {
      conceptId: 'cj.var.mutable',
      blockIds: ['cj.var.mutable.compare', 'cj.var.mutable.rule'],
    })

    expect(planned.blockIds).toEqual([
      'cj.var.mutable.rule',
      'cj.var.mutable.compare',
    ])
  })

  it('accepts templates only when their concepts and skill links are validated', () => {
    const index = getDefaultCourseContentIndex()
    const template = index.getExerciseTemplate('cj.var.immutable.choose-let.answer')!

    expect(() => assertTemplateBackedByValidatedConcepts(index, template)).not.toThrow()
  })
})
