import graphData from './concept-graph.json'
import type { ConceptGraph, ConceptNode } from './types'

const graph = graphData as ConceptGraph

const nodeIndex = new Map<string, ConceptNode>(graph.nodes.map(n => [n.conceptId, n]))

export function getAllConcepts(): ConceptNode[] {
  return graph.nodes
}

export function getConcept(id: string): ConceptNode | undefined {
  return nodeIndex.get(id)
}

export function getHardPrereqs(id: string): string[] {
  return getConcept(id)?.prerequisites ?? []
}

export type DemonstratedSet = Set<string>

/**
 * Returns concept ids whose hard prerequisites are all in `demonstrated`,
 * and which are themselves not yet demonstrated. Sorted by ascending difficulty
 * so the easiest "next step" surfaces first.
 */
export function getReadyConcepts(demonstrated: DemonstratedSet): ConceptNode[] {
  const ready: ConceptNode[] = []
  for (const node of graph.nodes) {
    if (demonstrated.has(node.conceptId))
      continue
    const allPrereqsMet = node.prerequisites.every(p => demonstrated.has(p))
    if (allPrereqsMet)
      ready.push(node)
  }
  return ready.sort((a, b) => a.difficulty - b.difficulty)
}

export function findChapterRefSections<T extends { chapterId: string, subChapterId: string, sectionId: string }>(
  ref: string,
  allSections: T[],
): T[] {
  const parts = ref.split('/')
  if (parts.length === 3) {
    const [c, s, sec] = parts
    return allSections.filter(x => x.chapterId === c && x.subChapterId === s && x.sectionId === sec)
  }
  if (parts.length === 2) {
    const [c, s] = parts
    return allSections.filter(x => x.chapterId === c && x.subChapterId === s)
  }
  if (parts.length === 1) {
    const [c] = parts
    return allSections.filter(x => x.chapterId === c)
  }
  return []
}
