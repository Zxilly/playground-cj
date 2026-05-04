import { readJSON, removeKey, writeJSON } from '@/lib/storage'

const STORAGE_KEY = 'tour-ai:learner:v1'

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

function emptyModel(): LearnerModel {
  return { version: 1, knownLanguages: [], concepts: {} }
}

export function readLearner(): LearnerModel {
  const raw = readJSON<LearnerModel | null>(STORAGE_KEY, null)
  if (!raw || raw.version !== 1)
    return emptyModel()
  return {
    version: 1,
    knownLanguages: Array.isArray(raw.knownLanguages) ? raw.knownLanguages : [],
    agentNotesSummary: raw.agentNotesSummary,
    concepts: raw.concepts && typeof raw.concepts === 'object' ? raw.concepts : {},
    activeQuiz: raw.activeQuiz ?? null,
  }
}

export function writeLearner(model: LearnerModel): void {
  writeJSON(STORAGE_KEY, model)
}

export function clearLearner(): void {
  removeKey(STORAGE_KEY)
}

/** Read once, apply mutations to the in-memory model, write once. */
export function mutateLearner(fn: (model: LearnerModel) => void): LearnerModel {
  const m = readLearner()
  fn(m)
  writeLearner(m)
  return m
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

export function setKnownLanguages(langs: string[]): LearnerModel {
  return mutateLearner((m) => {
    m.knownLanguages = Array.from(new Set(langs))
  })
}

export function setAgentNotesSummary(text: string | undefined): LearnerModel {
  return mutateLearner((m) => {
    m.agentNotesSummary = text && text.length > 0 ? text.slice(0, 300) : undefined
  })
}

export function updateConceptStatus(conceptId: string, status: ConceptStatus, notes?: string): LearnerModel {
  return mutateLearner(m => applyConceptStatus(m, conceptId, status, notes))
}

export function recordEvidence(conceptId: string, outcome: EvidenceOutcome): LearnerModel {
  return mutateLearner(m => applyEvidence(m, conceptId, outcome))
}

export function setActiveQuiz(quiz: ActiveQuiz | null): LearnerModel {
  return mutateLearner((m) => {
    m.activeQuiz = quiz
  })
}

export function bumpQuizAttempts(): LearnerModel {
  return mutateLearner((m) => {
    if (m.activeQuiz)
      m.activeQuiz.attempts += 1
  })
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
