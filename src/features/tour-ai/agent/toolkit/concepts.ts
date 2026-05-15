import { z } from 'zod'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import { getAllConcepts, getReadyConcepts } from '@/lib/ai/concept-graph/loader'
import type { ClassroomSession } from '@/lib/ai/classroom/types'
import { requireClassroom } from './shared'

export const readConceptsParameters = z.object({
  ids: z.array(z.string()).optional(),
})

function demonstratedSet(session: ClassroomSession): Set<string> {
  return new Set(Object.values(session.learner.concepts)
    .filter(concept => concept.status === 'demonstrated')
    .map(concept => concept.conceptId))
}

function skippedConceptCounts(session: ClassroomSession): Map<string, number> {
  const counts = new Map<string, number>()
  for (const evidence of session.learner.evidence) {
    if (evidence.outcome !== 'skip')
      continue
    counts.set(evidence.conceptId, (counts.get(evidence.conceptId) ?? 0) + 1)
  }
  return counts
}

export function readConcepts(bridge: AIClassroomBridgeValue, ids?: string[]) {
  const classroom = requireClassroom(bridge)
  const session = classroom.getSession()
  const concepts = getAllConcepts()
  const skipCounts = skippedConceptCounts(session)
  const selected = ids && ids.length > 0
    ? concepts.filter(concept => ids.includes(concept.conceptId))
    : [...getReadyConcepts(demonstratedSet(session))]
        .sort((a, b) => {
          const skipDelta = (skipCounts.get(a.conceptId) ?? 0) - (skipCounts.get(b.conceptId) ?? 0)
          if (skipDelta !== 0)
            return skipDelta
          return a.difficulty - b.difficulty
        })
        .slice(0, 20)

  return selected.map(concept => ({
    conceptId: concept.conceptId,
    title: concept.title[bridge.uiLang],
    summary: concept.summary[bridge.uiLang],
    difficulty: concept.difficulty,
    prerequisites: concept.prerequisites,
    status: session.learner.concepts[concept.conceptId]?.status ?? 'unseen',
    skipCount: skipCounts.get(concept.conceptId) ?? 0,
  }))
}
