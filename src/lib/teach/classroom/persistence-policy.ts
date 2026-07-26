import type { ClassroomSnapshot } from './state'

export const MAX_PERSISTED_DIAGNOSTIC_PREVIEW_BYTES = 16 * 1_024
export const MAX_CLASSROOM_TRACKS = 16
export const MAX_CLASSROOM_TRACK_ADJUSTMENTS = 128
export const MAX_CLASSROOM_STREAM_ENTRIES = 1_024
export const MAX_CLASSROOM_ASSISTANCE_EVENTS = 512
export const MAX_CLASSROOM_ATTEMPTS = 512
export const MAX_CLASSROOM_EVIDENCE = 512
export const MAX_CLASSROOM_REVIEW_ARTIFACTS = 256
export const MAX_CLASSROOM_REMOVED_REVIEW_ARTIFACTS = 256
export const MAX_CLASSROOM_SNAPSHOT_BYTES = 8 * 1_024 * 1_024
export const MAX_RESOLVED_RETENTION_AUDIT_TAIL = 64

export interface PersistedDiagnostic {
  head: string
  tail: string
  /** The runner omitted source bytes before this local summary was created. */
  sourceTruncated: boolean
  originalUtf8Bytes: number
  omittedUtf8Bytes: number
  sha256: string
  previewSha256: string
}

const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map(value => value.toString(16).padStart(2, '0'))
    .join('')
}

function decodeUtf8Prefix(bytes: Uint8Array, maximumBytes: number): string {
  let end = Math.min(maximumBytes, bytes.byteLength)
  while (end > 0) {
    try {
      return decoder.decode(bytes.subarray(0, end))
    }
    catch {
      end--
    }
  }
  return ''
}

function decodeUtf8Suffix(bytes: Uint8Array, maximumBytes: number): string {
  let start = Math.max(0, bytes.byteLength - maximumBytes)
  while (
    start < bytes.byteLength
    && (bytes[start]! & 0b1100_0000) === 0b1000_0000
  ) {
    start++
  }
  return decoder.decode(bytes.subarray(start))
}

async function sha256(value: Uint8Array): Promise<string> {
  if (typeof globalThis.crypto?.subtle?.digest !== 'function') {
    throw new TypeError(
      'crypto.subtle.digest() is required to persist AI Classroom diagnostics',
    )
  }
  const digestInput = new Uint8Array(value.byteLength)
  digestInput.set(value)
  return hex(await globalThis.crypto.subtle.digest('SHA-256', digestInput.buffer))
}

export async function summarizeAttemptDiagnostic(
  source: string,
  sourceTruncated = false,
): Promise<PersistedDiagnostic> {
  const bytes = encoder.encode(source)
  const originalUtf8Bytes = bytes.byteLength
  if (originalUtf8Bytes <= MAX_PERSISTED_DIAGNOSTIC_PREVIEW_BYTES) {
    const digest = await sha256(bytes)
    return {
      head: source,
      tail: '',
      sourceTruncated,
      originalUtf8Bytes,
      omittedUtf8Bytes: 0,
      sha256: digest,
      previewSha256: digest,
    }
  }

  const half = Math.floor(MAX_PERSISTED_DIAGNOSTIC_PREVIEW_BYTES / 2)
  const head = decodeUtf8Prefix(bytes, half)
  const tail = decodeUtf8Suffix(
    bytes,
    MAX_PERSISTED_DIAGNOSTIC_PREVIEW_BYTES - encoder.encode(head).byteLength,
  )
  const previewBytes = encoder.encode(head + tail)
  const previewUtf8Bytes = previewBytes.byteLength
  const [sourceDigest, previewDigest] = await Promise.all([
    sha256(bytes),
    sha256(previewBytes),
  ])
  return {
    head,
    tail,
    sourceTruncated,
    originalUtf8Bytes,
    omittedUtf8Bytes: originalUtf8Bytes - previewUtf8Bytes,
    sha256: sourceDigest,
    previewSha256: previewDigest,
  }
}

export async function assertPersistedDiagnosticIntegrity(
  diagnostic: PersistedDiagnostic,
  path = 'persisted diagnostic',
): Promise<void> {
  const actualPreviewSha256 = await sha256(
    encoder.encode(diagnostic.head + diagnostic.tail),
  )
  if (actualPreviewSha256 !== diagnostic.previewSha256) {
    throw new Error(
      `${path} preview SHA-256 does not match its retained head/tail`,
    )
  }
  if (
    diagnostic.omittedUtf8Bytes === 0
    && diagnostic.sha256 !== actualPreviewSha256
  ) {
    throw new Error(
      `${path} source SHA-256 does not match its complete retained text`,
    )
  }
}

/**
 * Re-hashes imported diagnostics at the storage boundary. Command execution
 * trusts summaries created in-process so its cost does not grow with history.
 */
export async function assertClassroomDiagnosticIntegrity(
  snapshot: ClassroomSnapshot,
): Promise<void> {
  const validations: Array<Promise<void>> = []
  for (const attempt of snapshot.attempts) {
    const diagnostics: Array<
      [field: string, diagnostic: PersistedDiagnostic | undefined]
    > = [
      ['stdout', attempt.result.stdout],
      ['stderr', attempt.result.stderr],
      ['compilerOutput', attempt.result.compilerOutput],
    ]
    for (const [field, diagnostic] of diagnostics) {
      if (diagnostic) {
        validations.push(assertPersistedDiagnosticIntegrity(
          diagnostic,
          `Attempt ${attempt.id} ${field}`,
        ))
      }
    }
  }
  await Promise.all(validations)
}

export function persistedDiagnosticPreviewUtf8Bytes(
  diagnostic: Pick<PersistedDiagnostic, 'head' | 'tail'>,
): number {
  return encoder.encode(diagnostic.head + diagnostic.tail).byteLength
}

export function classroomSnapshotUtf8Bytes(snapshot: unknown): number {
  return encoder.encode(JSON.stringify(snapshot)).byteLength
}

/**
 * Removes only resolved retention lifecycles whose identities are no longer
 * needed by an Exercise Instance. Active suppressions and every referenced
 * artifact remain immutable. The recent resolved tail stays available for
 * local audit while preventing an allow/remove cycle from growing forever.
 */
export function compactClassroomSnapshot(
  snapshot: ClassroomSnapshot,
): ClassroomSnapshot {
  const referencedArtifactIds = new Set(
    snapshot.stream.flatMap(entry =>
      entry.type === 'exercise_instance'
        ? entry.personalizationInputs.remediationArtifactIds
        : []),
  )
  const compactable = snapshot.removedReviewArtifacts
    .filter(artifact =>
      !artifact.suppressionActive
      && !referencedArtifactIds.has(artifact.id)
      && (
        artifact.type === 'clarification'
        || snapshot.reviewArtifacts.some(candidate =>
          candidate.type === 'remediation'
          && candidate.attemptIds.length === artifact.attemptIds.length
          && candidate.attemptIds.every(
            (attemptId, index) => attemptId === artifact.attemptIds[index],
          )
          && candidate.evidenceIds.length === artifact.evidenceIds.length
          && candidate.evidenceIds.every(
            (evidenceId, index) => evidenceId === artifact.evidenceIds[index],
          ))
      ))
    .sort((left, right) =>
      (left.retentionAllowedRevision ?? Number.MAX_SAFE_INTEGER)
      - (right.retentionAllowedRevision ?? Number.MAX_SAFE_INTEGER)
      || left.id.localeCompare(right.id))
  const overAuditTail = Math.max(
    0,
    compactable.length - MAX_RESOLVED_RETENTION_AUDIT_TAIL,
  )
  const overCollectionLimit = Math.max(
    0,
    snapshot.removedReviewArtifacts.length
    - MAX_CLASSROOM_REMOVED_REVIEW_ARTIFACTS,
  )
  const removalCount = Math.max(overAuditTail, overCollectionLimit)
  if (removalCount === 0)
    return snapshot

  const removedIds = new Set(
    compactable.slice(0, removalCount).map(artifact => artifact.id),
  )
  if (removedIds.size < removalCount)
    return snapshot

  return {
    ...snapshot,
    stream: snapshot.stream.filter(entry =>
      entry.type !== 'retention_marker'
      || !removedIds.has(entry.artifactId)),
    removedReviewArtifacts: snapshot.removedReviewArtifacts.filter(
      artifact => !removedIds.has(artifact.id),
    ),
  }
}

export function renderPersistedDiagnostic(
  diagnostic: PersistedDiagnostic,
): string {
  if (diagnostic.omittedUtf8Bytes === 0)
    return diagnostic.head
  return `${diagnostic.head}\n… ${diagnostic.omittedUtf8Bytes} UTF-8 bytes omitted (SHA-256 ${diagnostic.sha256}) …\n${diagnostic.tail}`
}
