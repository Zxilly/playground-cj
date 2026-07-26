const CONTENT_ADDRESSED_REVISION
  = /^(?<kind>cv|lc):sha256:(?<digest>[a-f0-9]{64})$/u

/**
 * Keep persisted/protocol revisions exact while giving content-addressed
 * identities a compact, non-overflowing visual label.
 */
export function formatRevisionLabel(revision: string): string {
  const match = CONTENT_ADDRESSED_REVISION.exec(revision)
  const kind = match?.groups?.kind
  const digest = match?.groups?.digest
  if (!kind || !digest)
    return revision
  return `${kind}:${digest.slice(0, 10)}…${digest.slice(-10)}`
}
