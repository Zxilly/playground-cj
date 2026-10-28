import { describe, expect, it } from 'vitest'
import { parseCompilerDiagnostics } from './compiler-diagnostics'

describe('compiler diagnostics', () => {
  it('keeps a multiline warning header and removes ANSI and the exit footer', () => {
    const esc = String.fromCharCode(27)
    const diagnostics = parseCompilerDiagnostics([
      'Cangjie Compiler',
      `${esc}[33mwarning: unused variable${esc}[0m`,
      '  --> main.cj:3:12',
      '3 | let value = 1',
      '----------',
      'exit code 0',
    ].join('\r\n'))
    expect(diagnostics).toEqual([{
      file: 'main.cj',
      line: 3,
      column: 12,
      severity: 'warning',
      message: 'warning: unused variable\n--> main.cj:3:12\n3 | let value = 1',
    }])
  })

  it('separates adjacent diagnostics and handles Windows file locations', () => {
    expect(parseCompilerDiagnostics([
      'main.cj:2:4: error: expected expression',
      'warning: unused value',
      ' at C:\\workspace\\main.cj:8:2',
    ].join('\n'))).toMatchObject([
      { severity: 'error', line: 2, column: 4, message: 'main.cj:2:4: error: expected expression' },
      { severity: 'warning', file: 'C:\\workspace\\main.cj', line: 8, column: 2 },
    ])
  })

  it('does not invent markers for output with no source location', () => {
    expect(parseCompilerDiagnostics('compiler unavailable\n----------\nexit code 1')).toEqual([])
  })
})
