import { afterEach, describe, expect, it } from 'vitest'
import {
  getDemonstratedSet,
  getRelevantConcepts,
  newQuizId,
} from './learner-model'
import { useLearnerStore } from '@/stores/learner'

const store = useLearnerStore

afterEach(() => {
  store.getState().clear()
  // Persist middleware writes through localStorage; wipe the key so the next
  // test starts from a clean slate even though the store itself has been reset.
  if (typeof window !== 'undefined')
    window.localStorage.removeItem('tour-ai:learner:v1')
})

describe('learner store', () => {
  it('returns empty model when nothing stored', () => {
    const m = store.getState().learner
    expect(m.version).toBe(1)
    expect(m.knownLanguages).toEqual([])
    expect(m.concepts).toEqual({})
  })

  it('persists known languages with dedup', () => {
    store.getState().setKnownLanguages(['Python', 'Go', 'Python'])
    expect(store.getState().learner.knownLanguages.sort()).toEqual(['Go', 'Python'])
  })

  it('clamps agent notes to 300 chars', () => {
    store.getState().setAgentNotesSummary('a'.repeat(400))
    expect(store.getState().learner.agentNotesSummary?.length).toBe(300)
  })

  it('updateConceptStatus tracks status + notes', () => {
    store.getState().updateConceptStatus('cj.var.basic', 'practicing', 'mixing let and var')
    const c = store.getState().learner.concepts['cj.var.basic']
    expect(c.status).toBe('practicing')
    expect(c.notes).toBe('mixing let and var')
  })

  it('recordEvidence increments counter and lifts unseen → practicing', () => {
    store.getState().recordEvidence('cj.io.println', 'success')
    const c = store.getState().learner.concepts['cj.io.println']
    expect(c.evidenceCount.success).toBe(1)
    expect(c.status).toBe('practicing')
  })

  it('does not auto-promote past practicing — agent must call updateConceptStatus', () => {
    store.getState().recordEvidence('cj.var.mutable', 'success')
    store.getState().recordEvidence('cj.var.mutable', 'success')
    expect(store.getState().learner.concepts['cj.var.mutable'].status).toBe('practicing')
  })

  it('getDemonstratedSet collects demonstrated + mastered only', () => {
    store.getState().updateConceptStatus('a', 'demonstrated')
    store.getState().updateConceptStatus('b', 'mastered')
    store.getState().updateConceptStatus('c', 'practicing')
    const set = getDemonstratedSet(store.getState().learner)
    expect(set).toEqual(new Set(['a', 'b']))
  })

  it('getRelevantConcepts always shows practicing/blocked, caps recents', () => {
    store.getState().updateConceptStatus('practicing-1', 'practicing')
    store.getState().updateConceptStatus('blocked-1', 'blocked')
    for (let i = 0; i < 20; i++)
      store.getState().updateConceptStatus(`exposed-${i}`, 'exposed')
    const out = getRelevantConcepts(store.getState().learner, 12)
    const ids = out.map(c => c.conceptId)
    expect(ids).toContain('practicing-1')
    expect(ids).toContain('blocked-1')
    expect(out.length).toBe(2 + 12)
  })

  it('quiz lifecycle: set → bump attempts → clear', () => {
    store.getState().setActiveQuiz({
      quizId: newQuizId(),
      conceptId: 'cj.var.basic',
      prompt: { zh: '题', en: 'q' },
      expectedOutput: '5',
      matchMode: 'exact',
      startedAt: 0,
      attempts: 0,
    })
    expect(store.getState().learner.activeQuiz?.attempts).toBe(0)
    store.getState().bumpQuizAttempts()
    store.getState().bumpQuizAttempts()
    expect(store.getState().learner.activeQuiz?.attempts).toBe(2)
    store.getState().setActiveQuiz(null)
    expect(store.getState().learner.activeQuiz).toBe(null)
  })
})
