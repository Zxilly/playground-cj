import { describe, expect, it } from 'vitest'
import { findChapterRefSections, getAllConcepts, getConcept, getReadyConcepts } from './loader'

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

  it('looks up every concept by id and rejects unknown ids', () => {
    for (const concept of getAllConcepts())
      expect(getConcept(concept.conceptId)).toBe(concept)

    expect(getConcept('cj.missing')).toBeUndefined()
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

  it('getReadyConcepts returns root concepts when nothing demonstrated', () => {
    const ready = getReadyConcepts(new Set())
    expect(ready.length).toBeGreaterThan(0)
    for (const r of ready)
      expect(r.prerequisites.length).toBe(0)
  })

  it('getReadyConcepts unlocks concepts after demonstrating prereq', () => {
    const main = 'cj.program.main'
    const after = getReadyConcepts(new Set([main]))

    expect(after.some(concept => concept.prerequisites.includes(main))).toBe(true)
    for (const concept of after) {
      expect(concept.conceptId).not.toBe(main)
      expect(concept.prerequisites.every(prereq => prereq === main || getConcept(prereq)?.prerequisites.length === 0)).toBe(true)
    }
    expect(after.map(concept => concept.difficulty)).toEqual([...after].map(concept => concept.difficulty).sort((a, b) => a - b))
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
