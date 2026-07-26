import { describe, expect, it } from 'vitest'
import { findChapterRefSections, getAllConcepts, parseConceptGraph } from './loader'

describe('concept-graph loader', () => {
  it('loads complete concept metadata with unique ids', () => {
    const all = getAllConcepts()
    const ids = new Set<string>()

    for (const concept of all) {
      expect(concept.conceptId).toMatch(/^cj\./)
      expect(ids.has(concept.conceptId), `duplicate concept ${concept.conceptId}`).toBe(false)
      expect(concept.title.zh).toBeTruthy()
      expect(concept.title.en).toBeTruthy()
      expect(concept.summary.zh).toBeTruthy()
      expect(concept.summary.en).toBeTruthy()
      expect(concept.difficulty).toBeGreaterThan(0)
      ids.add(concept.conceptId)
    }
  })

  it('all prerequisites resolve to known concepts', () => {
    const all = getAllConcepts()
    const ids = new Set(all.map(n => n.conceptId))
    for (const node of all) {
      for (const p of node.prerequisites)
        expect(ids.has(p), `concept ${node.conceptId} missing prereq ${p}`).toBe(true)
    }
  })

  it('detects no cycles in prerequisites', () => {
    const all = getAllConcepts()
    const visiting = new Set<string>()
    const visited = new Set<string>()
    const visit = (id: string, stack: string[]) => {
      if (visited.has(id))
        return
      if (visiting.has(id))
        throw new Error(`cycle: ${[...stack, id].join(' -> ')}`)
      visiting.add(id)
      const n = all.find(x => x.conceptId === id)!
      for (const p of n.prerequisites) visit(p, [...stack, id])
      visiting.delete(id)
      visited.add(id)
    }
    expect(() => all.forEach(n => visit(n.conceptId, []))).not.toThrow()
  })

  it('rejects malformed, duplicate, dangling, and cyclic concept graphs at the loading boundary', () => {
    const node = (conceptId: string, prerequisites: string[] = []) => ({
      chapterRefs: ['02-basics/01-bindings'],
      conceptId,
      difficulty: 1,
      prerequisites,
      summary: { en: 'Summary', zh: '摘要' },
      title: { en: 'Title', zh: '标题' },
    })

    expect(() => parseConceptGraph({
      nodes: [node('cj.first'), node('cj.first')],
      version: 1,
    })).toThrow(/duplicate/i)
    expect(() => parseConceptGraph({
      nodes: [node('cj.first', ['cj.missing'])],
      version: 1,
    })).toThrow(/unknown prerequisite/i)
    expect(() => parseConceptGraph({
      nodes: [
        node('cj.first', ['cj.second']),
        node('cj.second', ['cj.first']),
      ],
      version: 1,
    })).toThrow(/cycle/i)
    expect(() => parseConceptGraph({
      nodes: [{ ...node('cj.first'), difficulty: 9 }],
      version: 1,
    })).toThrow()
  })

  it('returns an immutable graph projection instead of shared mutable state', () => {
    const all = getAllConcepts()

    expect(Object.isFrozen(all)).toBe(true)
    expect(Object.isFrozen(all[0])).toBe(true)
    expect(Object.isFrozen(all[0].prerequisites)).toBe(true)
    expect(() => {
      ;(all as unknown as Array<unknown>).push({})
    }).toThrow()
  })

  it('findChapterRefSections matches sub-chapter prefix', () => {
    const sections = [
      { chapterId: '02-basics', subChapterId: '01-bindings', sectionId: '01' },
      { chapterId: '02-basics', subChapterId: '01-bindings', sectionId: '02' },
      { chapterId: '03-flow-control', subChapterId: '01-conditions', sectionId: '01' },
    ]
    expect(findChapterRefSections('02-basics/01-bindings', sections)).toHaveLength(2)
    expect(findChapterRefSections('02-basics/01-bindings/02', sections)).toHaveLength(1)
    expect(findChapterRefSections('02-basics', sections)).toHaveLength(2)
  })
})
