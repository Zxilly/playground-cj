import { describe, expect, it } from 'vitest'
import { satisfiesSourceRequirements, structuralCangjieSource } from './source-requirements'

describe('cangjie source requirements', () => {
  it('recognizes required bindings, calls, and real reassignment', () => {
    const source = `
main() {
  var count = 1
  count = count + 1
  println(count)
}`
    expect(satisfiesSourceRequirements(source, [
      { type: 'top_level_main' },
      { type: 'binding', binding: 'var', name: 'count' },
      { type: 'reassignment', name: 'count' },
      { type: 'call_identifier', functionName: 'println', argumentName: 'count' },
    ])).toBe(true)
  })

  it('accepts the explicit Unit return type used by valid Cangjie main functions', () => {
    expect(satisfiesSourceRequirements(`
main(): Unit {
  let answer = 42
  println(answer)
}`, [
      { type: 'top_level_main' },
      { type: 'binding', binding: 'let', name: 'answer' },
      { type: 'call_identifier', functionName: 'println', argumentName: 'answer' },
    ])).toBe(true)
  })

  it('accepts the Int64 return type used by repository and Playground entry points', () => {
    expect(satisfiesSourceRequirements(`
main(): Int64 {
  let answer = 42
  println(answer)
  return 0
}`, [
      { type: 'top_level_main' },
      { type: 'binding', binding: 'let', name: 'answer' },
      { type: 'call_identifier', functionName: 'println', argumentName: 'answer' },
    ])).toBe(true)
  })

  it('does not count the initializer as a reassignment', () => {
    expect(satisfiesSourceRequirements(
      'main() { var count = 2; println(count) }',
      [{ type: 'reassignment', name: 'count' }],
    )).toBe(false)
  })

  it('does not accept fake source in comments or string literals', () => {
    const source = `
main() {
  // let answer = 42
  let decoy = "println(answer)"
  println(42)
}`
    expect(satisfiesSourceRequirements(source, [
      { type: 'binding', binding: 'let', name: 'answer' },
      { type: 'call_identifier', functionName: 'println', argumentName: 'answer' },
    ])).toBe(false)
    expect(structuralCangjieSource(source)).not.toContain('println(answer)')
  })

  it('requires the target structure inside the top-level main body', () => {
    const decoy = `
func decoy() {
  let answer = 42
  println(answer)
}
main() {
  println(42)
}`
    expect(satisfiesSourceRequirements(decoy, [
      { type: 'top_level_main' },
      { type: 'binding', binding: 'let', name: 'answer' },
      { type: 'call_identifier', functionName: 'println', argumentName: 'answer' },
    ])).toBe(false)

    const nestedMain = `
func decoy() {
  main() { println(42) }
}
start() { println(42) }`
    expect(satisfiesSourceRequirements(
      nestedMain,
      [{ type: 'top_level_main' }],
    )).toBe(false)
  })

  it('checks the authored integer transformation instead of accepting a no-op', () => {
    const shortcut = `
main() {
  var count = 2
  count = count
  println(count)
}`
    const requirements = [
      { type: 'integer_binding' as const, binding: 'var' as const, name: 'count', value: 1 },
      { type: 'add_integer_reassignment' as const, name: 'count', amount: 1 },
      { type: 'call_identifier' as const, functionName: 'println' as const, argumentName: 'count' },
    ]
    expect(satisfiesSourceRequirements(shortcut, requirements)).toBe(false)
    expect(satisfiesSourceRequirements(`
main() {
  var count = 1
  count += 1
  println(count)
}`, requirements)).toBe(true)
  })

  it('does not accept required code hidden in a dead branch', () => {
    const requirements = [
      { type: 'integer_binding' as const, binding: 'var' as const, name: 'count', value: 1 },
      { type: 'add_integer_reassignment' as const, name: 'count', amount: 1 },
      { type: 'call_identifier' as const, functionName: 'println' as const, argumentName: 'count' },
    ]
    expect(satisfiesSourceRequirements(`
main() {
  if (false) {
    var count = 1
    count += 1
    println(count)
  }
  println(2)
}`, requirements)).toBe(false)
  })

  it('requires an unqualified, unshadowed built-in println call', () => {
    const requirements = [
      {
        type: 'integer_binding' as const,
        binding: 'let' as const,
        name: 'answer',
        value: 42,
      },
      {
        type: 'call_identifier' as const,
        functionName: 'println' as const,
        argumentName: 'answer',
      },
    ]
    expect(satisfiesSourceRequirements(`
class Sink {
  public func println(value: Int64): Unit {}
}
main() {
  let answer = 42
  Sink().println(answer)
  println(42)
}`, requirements)).toBe(false)
    expect(satisfiesSourceRequirements(`
func println(value: Int64): Unit {}
main() {
  let answer = 42
  println(answer)
}`, requirements)).toBe(false)
    expect(satisfiesSourceRequirements(`
import example.output as println
main() {
  let answer = 42
  println(answer)
}`, requirements)).toBe(false)
    expect(satisfiesSourceRequirements(`
main() {
  let answer = 42
  println(answer)
}`, requirements)).toBe(true)
  })

  it('does not accept required code after an early control-flow path', () => {
    const requirements = [
      { type: 'binding' as const, binding: 'let' as const, name: 'answer' },
      { type: 'call_identifier' as const, functionName: 'println' as const, argumentName: 'answer' },
    ]
    expect(satisfiesSourceRequirements(`
main() {
  println(42)
  return
  let answer = 42
  println(answer)
}`, requirements)).toBe(false)
  })
})
