import graphData from './concept-graph.json'
import { z } from 'zod'
import type { ConceptGraph, ConceptNode } from './types'

const localeTextSchema = z.strictObject({
  en: z.string().trim().min(1),
  zh: z.string().trim().min(1),
})

const conceptNodeSchema = z.strictObject({
  chapterRefs: z.array(z.string().trim().min(1)).min(1),
  commonMisconceptions: z.array(localeTextSchema).optional(),
  conceptId: z.string().regex(/^cj\.[a-z0-9-]+(?:\.[a-z0-9-]+)*$/),
  difficulty: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  docRefs: z.array(z.string().trim().min(1)).optional(),
  prerequisites: z.array(z.string()).default([]),
  summary: localeTextSchema,
  title: localeTextSchema,
})

const conceptGraphSchema = z.strictObject({
  nodes: z.array(conceptNodeSchema).min(1),
  version: z.literal(1),
})

function assertGraphIntegrity(graph: ConceptGraph): void {
  const byId = new Map<string, ConceptNode>()
  for (const node of graph.nodes) {
    if (byId.has(node.conceptId))
      throw new Error(`Concept Graph contains duplicate id ${node.conceptId}`)
    byId.set(node.conceptId, node)
  }

  for (const node of graph.nodes) {
    for (const prerequisite of node.prerequisites) {
      if (!byId.has(prerequisite)) {
        throw new Error(
          `Concept ${node.conceptId} has unknown prerequisite ${prerequisite}`,
        )
      }
    }
  }

  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (conceptId: string, path: readonly string[]): void => {
    if (visited.has(conceptId))
      return
    if (visiting.has(conceptId)) {
      throw new Error(
        `Concept Graph prerequisite cycle: ${[...path, conceptId].join(' -> ')}`,
      )
    }

    visiting.add(conceptId)
    const node = byId.get(conceptId)
    if (!node)
      throw new Error(`Concept Graph lost indexed node ${conceptId}`)
    for (const prerequisite of node.prerequisites)
      visit(prerequisite, [...path, conceptId])
    visiting.delete(conceptId)
    visited.add(conceptId)
  }

  for (const node of graph.nodes)
    visit(node.conceptId, [])
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value))
    return value

  for (const nested of Object.values(value))
    deepFreeze(nested)
  return Object.freeze(value)
}

export function parseConceptGraph(input: unknown): ConceptGraph {
  const parsed = conceptGraphSchema.parse(input)
  assertGraphIntegrity(parsed)
  return deepFreeze(parsed)
}

const graph = parseConceptGraph(graphData)

export function getAllConcepts(): readonly ConceptNode[] {
  return graph.nodes
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
