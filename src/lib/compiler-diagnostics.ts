import { stripTerminalSequences } from './compiler-output'

export interface CompilerDiagnostic {
  file: string
  line: number
  column: number
  severity: 'warning' | 'error'
  message: string
}

const LOCATION = /(?:^|[\s(])([^()\s]+\.cj):(\d+):(\d+)(?:[):\s]|$)/
const HEADING = /^(?:fatal\s+)?(?:error|warning)\s*:/i
const WARNING = /\bwarning\s*:/i
const SEPARATOR = /^-{3,}$/

/** Parse compiler text without depending on Monaco, React, or a page store. */
export function parseCompilerDiagnostics(output: string): CompilerDiagnostic[] {
  const lines = stripTerminalSequences(output).split(/\r?\n/)
  const diagnostics: CompilerDiagnostic[] = []
  let heading: string | undefined

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim()
    if (HEADING.test(line))
      heading = line
    const location = line.match(LOCATION)
    if (!location)
      continue
    const lineNumber = Number(location[2])
    const column = Number(location[3])
    if (!Number.isSafeInteger(lineNumber) || !Number.isSafeInteger(column))
      continue

    const parts = heading && heading !== line ? [heading, line] : [line]
    let nextIndex = index + 1
    while (nextIndex < lines.length) {
      const next = lines[nextIndex].trim()
      if (!next || LOCATION.test(next) || HEADING.test(next) || SEPARATOR.test(next))
        break
      parts.push(next)
      nextIndex++
    }
    diagnostics.push({
      file: location[1],
      line: lineNumber,
      column,
      severity: WARNING.test(heading ?? line) ? 'warning' : 'error',
      message: parts.join('\n'),
    })
    heading = undefined
    index = nextIndex - 1
  }
  return diagnostics
}
