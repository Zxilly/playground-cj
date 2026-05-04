import { describe, expect, it } from 'vitest'
import { replace } from './edit-strategies'

describe('replace', () => {
  it('does an exact replace', () => {
    expect(replace('hello world', 'world', 'there')).toBe('hello there')
  })

  it('throws when oldString equals newString', () => {
    expect(() => replace('a', 'a', 'a')).toThrow(/No changes/)
  })

  it('throws when oldString is not found', () => {
    expect(() => replace('hello', 'foo', 'bar')).toThrow(/Could not find/)
  })

  it('refuses ambiguous match without replaceAll', () => {
    expect(() => replace('foo foo', 'foo', 'bar')).toThrow(/multiple matches/)
  })

  it('handles replaceAll', () => {
    expect(replace('foo foo', 'foo', 'bar', true)).toBe('bar bar')
  })

  it('matches lines with different leading whitespace via LineTrimmedReplacer', () => {
    const content = 'main() {\n    println(\"hi\")\n}'
    const out = replace(content, 'println(\"hi\")', 'println(\"hello\")')
    expect(out).toBe('main() {\n    println(\"hello\")\n}')
  })

  it('block-anchor matches when middle lines diverge slightly', () => {
    const content = ['fn foo() {', '  let x = 1', '  let y = 2', '  return x + y', '}'].join('\n')
    const find = ['fn foo() {', '  // body', '  // body', '  // body', '}'].join('\n')
    const replacement = 'fn foo() {\n  return 42\n}'
    const out = replace(content, find, replacement)
    expect(out).toBe(replacement)
  })

  it('handles indentation-flexible matches', () => {
    const content = '        if (a) {\n            b()\n        }'
    const find = 'if (a) {\n    b()\n}'
    const out = replace(content, find, 'noop()')
    // Leading whitespace from the match is consumed because the replacer
    // matches the entire indented block.
    expect(out).toBe('noop()')
  })

  it('handles trimmed-boundary matches', () => {
    const content = 'before\nfoo\nafter'
    const out = replace(content, '\nfoo\n', 'foo')
    expect(out).toContain('foo')
  })
})
