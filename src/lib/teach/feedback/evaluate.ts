/**
 * How a code-task's actual output is compared against its expected output.
 *
 * - `exact`: trimmed actual must equal trimmed expected.
 * - `contains`: trimmed actual must include trimmed expected.
 * - `regex`: expected is treated as a regular expression matched against the
 *   trimmed actual; an invalid pattern evaluates to `false` rather than throwing.
 */
export type MatchMode = 'exact' | 'contains' | 'regex'

/** Strip trailing whitespace (including the conventional terminal newline). */
function trimTrailing(text: string): string {
  return text.replace(/\s+$/u, '')
}

/**
 * Compare a program's `actual` output against the `expected` value under the
 * given {@link MatchMode}. Both sides have trailing whitespace trimmed so a
 * stray terminal newline never causes a false negative. An invalid `regex`
 * pattern yields `false` instead of throwing.
 */
export function evaluateOutput(actual: string, expected: string, matchMode: MatchMode): boolean {
  const trimmedActual = trimTrailing(actual)
  const trimmedExpected = trimTrailing(expected)

  if (matchMode === 'contains')
    return trimmedActual.includes(trimmedExpected)

  if (matchMode === 'regex') {
    try {
      return new RegExp(trimmedExpected).test(trimmedActual)
    }
    catch {
      return false
    }
  }

  return trimmedActual === trimmedExpected
}
