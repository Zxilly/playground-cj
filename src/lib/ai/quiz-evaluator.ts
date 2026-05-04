import type { ActiveQuiz, QuizMatchMode } from '@/lib/ai/learner-model'

export interface QuizEvalResult {
  matched: boolean
  expected: string
  actual: string
  matchMode: QuizMatchMode
  diff?: string
}

function trimTrailing(s: string): string {
  return s.replace(/\s+$/g, '')
}

export function evaluateQuiz(quiz: ActiveQuiz, programOutput: string): QuizEvalResult {
  const actual = trimTrailing(programOutput)
  const expected = trimTrailing(quiz.expectedOutput)
  let matched = false
  switch (quiz.matchMode) {
    case 'exact':
      matched = actual === expected
      break
    case 'contains':
      matched = actual.includes(expected)
      break
    case 'regex':
      try {
        matched = new RegExp(expected, 'm').test(actual)
      }
      catch {
        matched = false
      }
      break
  }
  const result: QuizEvalResult = { matched, expected, actual, matchMode: quiz.matchMode }
  if (!matched)
    result.diff = `expected: ${JSON.stringify(expected)}\nactual:   ${JSON.stringify(actual)}`
  return result
}

/**
 * Structured next-step hints for the agent — keep the wording out of the tool result so
 * the agent decides phrasing. The system prompt explains how to act on each key.
 */
export type QuizHintKey
  = | 'quiz-passed-evaluate-approach'
    | 'quiz-passed-consider-mastered'
    | 'quiz-passed-advance-next-concept'
    | 'quiz-failed-give-local-hint'
    | 'quiz-failed-after-multiple-attempts'

export function buildQuizHints(passed: boolean, attempts: number): QuizHintKey[] {
  if (passed)
    return ['quiz-passed-evaluate-approach', 'quiz-passed-consider-mastered', 'quiz-passed-advance-next-concept']
  if (attempts >= 3)
    return ['quiz-failed-after-multiple-attempts']
  return ['quiz-failed-give-local-hint']
}
