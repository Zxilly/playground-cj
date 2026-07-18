/**
 * Student-facing compiler output. `diagnostic` is the useful portion shown
 * first; `full` is the ANSI-free complete log that may be disclosed on demand.
 */
export interface FormattedCompilerOutput {
  diagnostic: string
  full: string
  hasHiddenPreamble: boolean
}

/**
 * Strip terminal control sequences without interpreting them as HTML. The
 * runner emits CSI colour/cursor codes and occasionally OSC title sequences.
 */
export function stripTerminalSequences(input: string): string {
  const escape = String.fromCharCode(27)
  const bell = String.fromCharCode(7)
  let output = ''

  for (let index = 0; index < input.length;) {
    if (input[index] !== escape) {
      output += input[index]
      index += 1
      continue
    }

    const kind = input[index + 1]
    if (kind === '[') {
      // CSI: consume through the final byte in the ASCII @–~ range.
      index += 2
      while (index < input.length) {
        const code = input.charCodeAt(index)
        index += 1
        if (code >= 0x40 && code <= 0x7E)
          break
      }
      continue
    }
    if (kind === ']') {
      // OSC: terminated by BEL or the two-byte ESC + backslash sequence.
      index += 2
      while (index < input.length) {
        if (input[index] === bell) {
          index += 1
          break
        }
        if (input[index] === escape && input[index + 1] === '\\') {
          index += 2
          break
        }
        index += 1
      }
      continue
    }

    // Unknown escape form: discard the introducer and its immediate command.
    index += kind === undefined ? 1 : 2
  }

  return output
}

function isDiagnosticStart(line: string): boolean {
  const text = line.trimStart()
  return /^(?:\[\s*)?(?:fatal\s+)?(?:error|warning)(?:\s*\])?\s*:/i.test(text)
    || /^[^:\n]+:\d+(?::\d+)?:\s*(?:fatal\s+)?(?:error|warning)\s*:/i.test(text)
}

/**
 * Remove terminal noise and promote the first real compiler diagnostic above
 * runner commands/version banners. If no diagnostic marker exists, preserve
 * the complete clean text so an unusual failure never disappears.
 */
export function formatCompilerOutput(input: string): FormattedCompilerOutput {
  const full = stripTerminalSequences(input)
    .replace(/\r\n?/g, '\n')
    .trim()
  const lines = full.split('\n')
  const diagnosticIndex = lines.findIndex(isDiagnosticStart)
  const diagnostic = diagnosticIndex > 0
    ? lines.slice(diagnosticIndex).join('\n').trim()
    : full

  return {
    diagnostic,
    full,
    hasHiddenPreamble: diagnosticIndex > 0,
  }
}
