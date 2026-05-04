export const CONCEPT_STATUSES = ['unseen', 'exposed', 'practicing', 'demonstrated', 'mastered', 'blocked'] as const
export type ConceptStatus = typeof CONCEPT_STATUSES[number]

export const EVIDENCE_OUTCOMES = ['success', 'partial', 'failed'] as const
export type EvidenceOutcome = typeof EVIDENCE_OUTCOMES[number]

export const QUIZ_MATCH_MODES = ['exact', 'contains', 'regex'] as const
export type QuizMatchMode = typeof QUIZ_MATCH_MODES[number]

export interface EvidenceCount {
  success: number
  partial: number
  failed: number
}

export interface ConceptProgress {
  conceptId: string
  status: ConceptStatus
  lastTouchedAt: number
  evidenceCount: EvidenceCount
  lastEvidenceAt?: number
  notes?: string
}

export interface ActiveQuiz {
  quizId: string
  conceptId: string
  prompt: { zh: string, en: string }
  expectedOutput: string
  matchMode: QuizMatchMode
  startedAt: number
  attempts: number
}

export interface LearnerModel {
  version: 1
  knownLanguages: string[]
  agentNotesSummary?: string
  concepts: Record<string, ConceptProgress>
  activeQuiz?: ActiveQuiz | null
}

function emptyEvidence(): EvidenceCount {
  return { success: 0, partial: 0, failed: 0 }
}

export function emptyLearner(): LearnerModel {
  return { version: 1, knownLanguages: [], concepts: {} }
}

export function ensureConcept(model: LearnerModel, conceptId: string): ConceptProgress {
  let c = model.concepts[conceptId]
  if (!c) {
    c = {
      conceptId,
      status: 'unseen',
      lastTouchedAt: Date.now(),
      evidenceCount: emptyEvidence(),
    }
    model.concepts[conceptId] = c
  }
  return c
}

export function applyConceptStatus(model: LearnerModel, conceptId: string, status: ConceptStatus, notes?: string): void {
  const c = ensureConcept(model, conceptId)
  c.status = status
  c.lastTouchedAt = Date.now()
  if (notes !== undefined)
    c.notes = notes.slice(0, 280)
}

export function applyEvidence(model: LearnerModel, conceptId: string, outcome: EvidenceOutcome): void {
  const c = ensureConcept(model, conceptId)
  c.evidenceCount[outcome] += 1
  c.lastEvidenceAt = Date.now()
  c.lastTouchedAt = c.lastEvidenceAt
  if (c.status === 'unseen')
    c.status = 'practicing'
}

export function getDemonstratedSet(m: LearnerModel): Set<string> {
  const set = new Set<string>()
  for (const [id, c] of Object.entries(m.concepts)) {
    if (c.status === 'demonstrated' || c.status === 'mastered')
      set.add(id)
  }
  return set
}

/** Concepts the agent likely cares about right now — capped to keep tool responses small. */
export function getRelevantConcepts(m: LearnerModel, recentLimit = 12): ConceptProgress[] {
  const all = Object.values(m.concepts)
  const alwaysShow = all.filter(c => c.status === 'practicing' || c.status === 'blocked')
  const others = all
    .filter(c => c.status !== 'practicing' && c.status !== 'blocked')
    .sort((a, b) => (b.lastTouchedAt ?? 0) - (a.lastTouchedAt ?? 0))
    .slice(0, recentLimit)
  return [...alwaysShow, ...others]
}

export function newQuizId(): string {
  return `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}
