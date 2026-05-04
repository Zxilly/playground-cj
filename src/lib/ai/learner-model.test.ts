import { afterEach, describe, expect, it } from 'vitest'
import {
  bumpQuizAttempts,
  clearLearner,
  getDemonstratedSet,
  getRelevantConcepts,
  newQuizId,
  readLearner,
  recordEvidence,
  setActiveQuiz,
  setAgentNotesSummary,
  setKnownLanguages,
  updateConceptStatus,
} from './learner-model'

afterEach(() => {
  clearLearner()
})

describe('learner-model', () => {
  it('returns empty model when nothing stored', () => {
    const m = readLearner()
    expect(m.version).toBe(1)
    expect(m.knownLanguages).toEqual([])
    expect(m.concepts).toEqual({})
  })

  it('persists known languages with dedup', () => {
    setKnownLanguages(['Python', 'Go', 'Python'])
    expect(readLearner().knownLanguages.sort()).toEqual(['Go', 'Python'])
  })

  it('clamps agent notes to 300 chars', () => {
    setAgentNotesSummary('a'.repeat(400))
    expect(readLearner().agentNotesSummary?.length).toBe(300)
  })

  it('updateConceptStatus tracks status + notes', () => {
    updateConceptStatus('cj.var.basic', 'practicing', 'mixing let and var')
    const c = readLearner().concepts['cj.var.basic']
    expect(c.status).toBe('practicing')
    expect(c.notes).toBe('mixing let and var')
  })

  it('recordEvidence increments counter and lifts unseen → practicing', () => {
    recordEvidence('cj.io.println', 'success')
    const c = readLearner().concepts['cj.io.println']
    expect(c.evidenceCount.success).toBe(1)
    expect(c.status).toBe('practicing')
  })

  it('does not auto-promote past practicing — agent must call updateConceptStatus', () => {
    recordEvidence('cj.var.mutable', 'success')
    recordEvidence('cj.var.mutable', 'success')
    expect(readLearner().concepts['cj.var.mutable'].status).toBe('practicing')
  })

  it('getDemonstratedSet collects demonstrated + mastered only', () => {
    updateConceptStatus('a', 'demonstrated')
    updateConceptStatus('b', 'mastered')
    updateConceptStatus('c', 'practicing')
    const set = getDemonstratedSet(readLearner())
    expect(set).toEqual(new Set(['a', 'b']))
  })

  it('getRelevantConcepts always shows practicing/blocked, caps recents', () => {
    updateConceptStatus('practicing-1', 'practicing')
    updateConceptStatus('blocked-1', 'blocked')
    for (let i = 0; i < 20; i++)
      updateConceptStatus(`exposed-${i}`, 'exposed')
    const out = getRelevantConcepts(readLearner(), 12)
    const ids = out.map(c => c.conceptId)
    expect(ids).toContain('practicing-1')
    expect(ids).toContain('blocked-1')
    expect(out.length).toBe(2 + 12)
  })

  it('quiz lifecycle: set → bump attempts → clear', () => {
    setActiveQuiz({
      quizId: newQuizId(),
      conceptId: 'cj.var.basic',
      prompt: { zh: '题', en: 'q' },
      expectedOutput: '5',
      matchMode: 'exact',
      startedAt: 0,
      attempts: 0,
    })
    expect(readLearner().activeQuiz?.attempts).toBe(0)
    bumpQuizAttempts()
    bumpQuizAttempts()
    expect(readLearner().activeQuiz?.attempts).toBe(2)
    setActiveQuiz(null)
    expect(readLearner().activeQuiz).toBe(null)
  })
})
