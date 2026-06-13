import { describe, expect, it } from 'vitest'
import { evaluateOutput } from './evaluate'

describe('evaluateOutput', () => {
  it('exact trims trailing newline', () => expect(evaluateOutput('hi\n', 'hi', 'exact')).toBe(true))
  it('contains', () => expect(evaluateOutput('a hi b', 'hi', 'contains')).toBe(true))
  it('regex', () => expect(evaluateOutput('hello 42', '\\d+', 'regex')).toBe(true))
  it('exact mismatch', () => expect(evaluateOutput('ho', 'hi', 'exact')).toBe(false))
  it('invalid regex returns false', () => expect(evaluateOutput('x', '(', 'regex')).toBe(false))
})
