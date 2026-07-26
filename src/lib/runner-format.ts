import type { RunnerFormatResponse } from './runner-contract'

/**
 * Apply formatter text only when the runner confirms the returned source is
 * complete. A partial formatter result is diagnostic data, never editor input.
 */
export function applyCompleteFormattedSource(
  response: RunnerFormatResponse,
  onFormatted: ((code: string) => void) | undefined,
): boolean {
  if (response.formatter_code !== 0 || response.formatted_truncated)
    return false
  onFormatted?.(response.formatted)
  return true
}
