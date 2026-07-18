import { describe, expect, it } from 'vitest'
import { formatCompilerOutput, stripTerminalSequences } from './compiler-output'

const ESC = String.fromCharCode(27)

describe('compiler output formatting', () => {
  it('removes ANSI and promotes the first diagnostic over runner metadata', () => {
    const runnerOutput = [
      `${ESC}[36m$ /opt/cangjie/bin/cjc main.cj -o main${ESC}[0m`,
      'Cangjie Compiler 1.0.0 (linux-x86_64)',
      `${ESC}[31merror: expected expression after '='${ESC}[0m`,
      '  --> main.cj:3:12',
      '   |',
      ' 3 | let value =',
    ].join('\r\n')

    expect(formatCompilerOutput(runnerOutput)).toEqual({
      diagnostic: [
        `error: expected expression after '='`,
        '  --> main.cj:3:12',
        '   |',
        ' 3 | let value =',
      ].join('\n'),
      full: [
        '$ /opt/cangjie/bin/cjc main.cj -o main',
        'Cangjie Compiler 1.0.0 (linux-x86_64)',
        `error: expected expression after '='`,
        '  --> main.cj:3:12',
        '   |',
        ' 3 | let value =',
      ].join('\n'),
      hasHiddenPreamble: true,
    })
  })

  it('recognises file-position-prefixed warnings', () => {
    const result = formatCompilerOutput([
      'runner: cjc main.cj',
      'main.cj:4:7: warning: unused variable',
      'let unused = 1',
    ].join('\n'))
    expect(result.diagnostic).toBe('main.cj:4:7: warning: unused variable\nlet unused = 1')
    expect(result.hasHiddenPreamble).toBe(true)
  })

  it('keeps an unusual failure intact when it has no diagnostic marker', () => {
    const result = formatCompilerOutput(`${ESC}[31mcompiler process exited unexpectedly${ESC}[0m`)
    expect(result.diagnostic).toBe('compiler process exited unexpectedly')
    expect(result.full).toBe(result.diagnostic)
    expect(result.hasHiddenPreamble).toBe(false)
  })

  it('strips OSC terminal title sequences', () => {
    expect(stripTerminalSequences(`${ESC}]0;runner${String.fromCharCode(7)}error: boom`)).toBe('error: boom')
  })
})
