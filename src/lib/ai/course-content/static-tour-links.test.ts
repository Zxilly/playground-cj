import { describe, expect, it } from 'vitest'
import {
  createStaticTourRouteIndex,
  findDefaultCourseEntryForStaticTourSection,
  getPrimaryStaticTourSectionForConcept,
  getStaticTourSourceHref,
  getStaticTourTopicEntryHref,
  staticTourRest,
} from './static-tour-links'

describe('static tour course-content links', () => {
  it('maps a static tour section to the validated default course entry', () => {
    const entry = findDefaultCourseEntryForStaticTourSection({
      chapterId: '01-welcome',
      subChapterId: '01-intro',
      sectionId: '01',
    })

    expect(entry).toMatchObject({
      packId: 'default-entry',
      contentVersion: '2026-05-28',
      primaryConceptId: 'cj.program.main',
    })
    expect(entry?.conceptIds).toEqual(['cj.program.main', 'cj.io.println'])
    expect(entry?.blockIds).toEqual(expect.arrayContaining(['cj.program.main.heading', 'cj.io.println.heading']))
    expect(entry?.skillIds).toEqual(expect.arrayContaining(['cj.program.main.write-entry', 'cj.io.println.print-value']))
    expect(entry?.exerciseTemplateIds).toEqual(expect.arrayContaining(['cj.program.main.write-entry.hello']))
    expect(entry?.statuses).toMatchObject({
      'cj.program.main': 'validated',
      'cj.io.println': 'validated',
    })
    expect(entry?.sourceAddress).toEqual({
      chapterId: '01-welcome',
      subChapterId: '01-intro',
      sectionId: '01',
    })
    expect(entry?.sourceRouteRest).toEqual(['welcome', '1'])
  })

  it('returns null for static tour sections outside the validated pack', () => {
    expect(findDefaultCourseEntryForStaticTourSection({
      chapterId: '99-missing',
      subChapterId: '01-none',
      sectionId: '01',
    })).toBeNull()
  })

  it('finds the primary static source section for a concept', () => {
    const source = getPrimaryStaticTourSectionForConcept('cj.var.immutable')

    expect(source).toEqual({
      chapterId: '02-basics',
      subChapterId: '01-bindings',
      sectionId: '01',
    })
    expect(staticTourRest(source!)).toEqual(['basics', '1'])
  })

  it('normalizes source addresses before matching course entries', () => {
    const entry = findDefaultCourseEntryForStaticTourSection({
      chapterId: '02-basics',
      subChapterId: '01-bindings',
      sectionId: '1',
    })

    expect(entry?.primaryConceptId).toBe('cj.var.immutable')
    expect(entry?.sourceAddress.sectionId).toBe('01')
  })

  it('can use loaded tour route metadata instead of the manual fallback', () => {
    const entry = findDefaultCourseEntryForStaticTourSection({
      chapterId: '02-basics',
      subChapterId: '02-basic-types',
      sectionId: '01',
    }, { routeRest: ['basics', '3'] })

    expect(entry?.sourceRouteRest).toEqual(['basics', '3'])
    expect(staticTourRest(entry!.sourceAddress)).toEqual(['basics', '8'])
  })

  it('projects static tour source hrefs through the adapter', () => {
    const routeIndex = createStaticTourRouteIndex([
      {
        chapterId: '02-basics',
        subChapterId: '01-bindings',
        sectionId: '01',
        routeRest: ['basics', '1'],
      },
    ])

    expect(getStaticTourSourceHref('zh', {
      conceptId: 'cj.var.immutable',
      currentOrigin: 'http://localhost:3000',
      routeIndex,
    })).toBe('/zh/tour/basics/1')
  })

  it('projects topic entry hrefs through the adapter', () => {
    const entry = findDefaultCourseEntryForStaticTourSection({
      chapterId: '01-welcome',
      subChapterId: '01-intro',
      sectionId: '01',
    })

    expect(getStaticTourTopicEntryHref('zh', {
      entry,
      currentOrigin: 'http://localhost:3000',
    })).toBe('/zh/tour/ai?topic=cj.program.main')
  })
})
