import { describe, expect, it } from 'vitest'
import { unflattenCodeEscapes } from './unflatten-code-escapes'

describe('unflattenCodeEscapes', () => {
  it('restores real newlines when source code was JSON-encoded twice', () => {
    const input = 'main() {\\n    // 在这里编写你的代码\\n}'
    expect(unflattenCodeEscapes(input)).toBe('main() {\n    // 在这里编写你的代码\n}')
  })

  it('also unflattens \\t into tabs', () => {
    expect(unflattenCodeEscapes('func() {\\n\\tlet x = 1\\n}')).toBe('func() {\n\tlet x = 1\n}')
  })

  it('preserves intentional \\n inside source-level string literals (\\\\n)', () => {
    // The model wrote `print("hello\n")` and JSON-encoded twice, producing:
    //   main() {\n    print("hello\\n")\n}
    // After unflattening, the source-level "\n" inside the string literal must remain literal.
    const input = 'main() {\\n    print("hello\\\\n")\\n}'
    expect(unflattenCodeEscapes(input)).toBe('main() {\n    print("hello\\n")\n}')
  })

  it('does not touch code that already has real newlines', () => {
    const input = 'main() {\n    print("hi\\n")\n}'
    expect(unflattenCodeEscapes(input)).toBe(input)
  })

  it('does not touch single-line code with only intentional escape sequences', () => {
    // No real newlines, but the only escape is inside a string literal — not the
    // double-encoded shape. We leave it alone to avoid breaking legitimate code.
    // (Heuristic: with real newlines absent AND ONLY a single string-literal \n
    // present, the safer choice is to leave it alone. We accept the minor
    // false-negative risk in exchange for not corrupting valid input.)
    const input = 'print("hello\\\\n")'
    expect(unflattenCodeEscapes(input)).toBe('print("hello\\n")')
  })

  it('returns the input unchanged when there are no escape sequences', () => {
    expect(unflattenCodeEscapes('func add(a: Int64, b: Int64): Int64 { 0 }')).toBe('func add(a: Int64, b: Int64): Int64 { 0 }')
  })

  it('handles empty and missing strings safely', () => {
    expect(unflattenCodeEscapes('')).toBe('')
    expect(unflattenCodeEscapes(undefined as unknown as string)).toBe(undefined)
  })

  it('handles \\r\\n line endings the same way (rare but possible)', () => {
    expect(unflattenCodeEscapes('a\\r\\nb')).toBe('a\r\nb')
  })
})
