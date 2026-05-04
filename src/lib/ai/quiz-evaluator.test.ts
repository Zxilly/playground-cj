import { describe, expect, it } from 'vitest'
import { buildQuizHints, evaluateQuiz } from './quiz-evaluator'
import type { ActiveQuiz } from './learner-model'

const base: Omit<ActiveQuiz, 'expectedOutput' | 'matchMode'> = {
  quizId: 'q1',
  conceptId: 'cj.var.basic',
  prompt: { zh: '', en: '' },
  startedAt: 0,
  attempts: 0,
}

describe('evaluateQuiz', () => {
  it('exact match trims trailing whitespace', () => {
    const q: ActiveQuiz = { ...base, expectedOutput: '5', matchMode: 'exact' }
    expect(evaluateQuiz(q, '5\n').matched).toBe(true)
    expect(evaluateQuiz(q, '5  \n').matched).toBe(true)
    expect(evaluateQuiz(q, '6').matched).toBe(false)
  })

  it('contains mode', () => {
    const q: ActiveQuiz = { ...base, expectedOutput: 'OK', matchMode: 'contains' }
    expect(evaluateQuiz(q, 'result: OK\n').matched).toBe(true)
    expect(evaluateQuiz(q, 'fail').matched).toBe(false)
  })

  it('regex mode trims trailing whitespace consistently with other modes', () => {
    const q: ActiveQuiz = { ...base, expectedOutput: '^\\d+$', matchMode: 'regex' }
    expect(evaluateQuiz(q, '42').matched).toBe(true)
    expect(evaluateQuiz(q, '42\n').matched).toBe(true)
    expect(evaluateQuiz(q, '4a').matched).toBe(false)
  })

  it('produces diff on mismatch', () => {
    const q: ActiveQuiz = { ...base, expectedOutput: '1', matchMode: 'exact' }
    const r = evaluateQuiz(q, '2')
    expect(r.matched).toBe(false)
    expect(r.diff).toContain('expected')
    expect(r.diff).toContain('actual')
  })
})

describe('buildQuizHints', () => {
  it('passed → 3-step hint chain', () => {
    expect(buildQuizHints(true, 1)).toEqual([
      'quiz-passed-evaluate-approach',
      'quiz-passed-consider-mastered',
      'quiz-passed-advance-next-concept',
    ])
  })

  it('failed under 3 attempts → local hint', () => {
    expect(buildQuizHints(false, 1)).toEqual(['quiz-failed-give-local-hint'])
    expect(buildQuizHints(false, 2)).toEqual(['quiz-failed-give-local-hint'])
  })

  it('failed at 3+ attempts → escalation hint', () => {
    expect(buildQuizHints(false, 3)).toEqual(['quiz-failed-after-multiple-attempts'])
    expect(buildQuizHints(false, 5)).toEqual(['quiz-failed-after-multiple-attempts'])
  })
})
