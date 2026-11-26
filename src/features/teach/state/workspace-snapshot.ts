import { z } from 'zod'
import type { ContentPackCatalog } from '@/lib/teach/classroom/content-catalog'
import { assertClassroomIntegrity } from '@/lib/teach/classroom/integrity'
import { assertClassroomDiagnosticIntegrity } from '@/lib/teach/classroom/persistence-policy'
import type { ClassroomSnapshot, LearningTrack } from '@/lib/teach/classroom/state'
import {
  classroomSnapshotSchema,
  createEmptyClassroom,
  MAX_LEARNING_TRACK_CONCEPTS,
} from '@/lib/teach/classroom/state'
import type { ClassroomScopeRecord } from '@/lib/teach/classroom/storage'
import { PLAYGROUND_WORKSPACE_LIMITS, utf8ByteLength } from './playground-workspace-storage'

export const WORKSPACE_SNAPSHOT_FORMAT = 'playground-cj.ai-classroom.workspace'
export const WORKSPACE_SNAPSHOT_VERSION = 1
export const MAX_WORKSPACE_IMPORT_BYTES = 4 * 1024 * 1024

const exportedPlaygroundTabSchema = z.object({
  id: z.string().min(1).max(128),
  title: z.string().trim().min(1).max(PLAYGROUND_WORKSPACE_LIMITS.maxTitleBytes),
  code: z.string().max(PLAYGROUND_WORKSPACE_LIMITS.maxCodeBytesPerTab),
}).strict().superRefine((tab, context) => {
  if (utf8ByteLength(tab.title) > PLAYGROUND_WORKSPACE_LIMITS.maxTitleBytes) {
    context.addIssue({
      code: 'custom',
      path: ['title'],
      message: 'Playground tab title exceeds its UTF-8 byte limit',
    })
  }
  if (utf8ByteLength(tab.code) > PLAYGROUND_WORKSPACE_LIMITS.maxCodeBytesPerTab) {
    context.addIssue({
      code: 'custom',
      path: ['code'],
      message: 'Playground tab code exceeds its UTF-8 byte limit',
    })
  }
})

export const workspaceSnapshotBundleSchema = z.object({
  format: z.literal(WORKSPACE_SNAPSHOT_FORMAT),
  version: z.literal(WORKSPACE_SNAPSHOT_VERSION),
  exportedAt: z.string().min(1).max(64),
  courseVersion: z.string().min(1).max(200),
  classroom: classroomSnapshotSchema,
  playground: z.object({
    tabs: z.array(exportedPlaygroundTabSchema).max(PLAYGROUND_WORKSPACE_LIMITS.maxTabs),
  }).strict(),
  legacyClassrooms: z.array(z.object({
    scope: z.string().min(1).max(256),
    snapshot: classroomSnapshotSchema,
  }).strict()).max(32).optional(),
}).strict()

export type WorkspaceSnapshotBundle = z.infer<typeof workspaceSnapshotBundleSchema>

function snapshotActivityScore(snapshot: ClassroomSnapshot): number {
  const timestamps: number[] = []
  for (const track of snapshot.tracks)
    timestamps.push(track.createdAt)
  for (const entry of snapshot.stream)
    timestamps.push(entry.createdAt)
  for (const attempt of snapshot.attempts)
    timestamps.push(attempt.createdAt)
  return timestamps.length > 0 ? Math.max(...timestamps) : snapshot.revision
}

function hasClassroomActivity(snapshot: ClassroomSnapshot): boolean {
  return snapshot.tracks.length > 0
    || snapshot.stream.length > 0
    || snapshot.attempts.length > 0
    || snapshot.evidence.length > 0
    || snapshot.reviewArtifacts.length > 0
}

/**
 * Attempts to carry over a previous Course-version classroom snapshot into the
 * current catalog without silently discarding progress:
 *
 *  1. If the entire snapshot still satisfies the current catalog's integrity
 *     invariants (e.g., an unrelated concept changed), preserve it verbatim.
 *  2. Otherwise, migrate every compatible Learning Track (filtering concepts to
 *     those present in the current catalog and re-pinning their current content
 *     versions) so the learner's goals and study paths carry over safely, while
 *     the original scope remains untouched in IndexedDB for backup export.
 */
export async function migrateCompatibleClassroomSnapshot(
  previous: ClassroomSnapshot,
  catalog: ContentPackCatalog,
): Promise<ClassroomSnapshot | null> {
  if (!hasClassroomActivity(previous))
    return null

  const parsed = classroomSnapshotSchema.safeParse(previous)
  if (!parsed.success)
    return null

  try {
    await assertClassroomDiagnosticIntegrity(parsed.data)
    assertClassroomIntegrity(parsed.data, catalog)
    return structuredClone({
      ...parsed.data,
      revision: Math.max(1, parsed.data.revision),
    })
  }
  catch {
    // Fall through to safe track-level migration when content hashes changed.
  }

  const migratedTracks: LearningTrack[] = []
  for (const track of parsed.data.tracks) {
    const validConceptIds: string[] = []
    const seen = new Set<string>()
    for (const conceptId of track.conceptIds) {
      if (seen.has(conceptId))
        continue
      const pack = catalog.get(conceptId)
      if (!pack)
        continue
      if (!pack.concept.prerequisites.every(prerequisite => seen.has(prerequisite)))
        continue
      seen.add(conceptId)
      validConceptIds.push(conceptId)
      if (validConceptIds.length >= MAX_LEARNING_TRACK_CONCEPTS)
        break
    }
    if (validConceptIds.length === 0)
      continue
    const contentVersions: Record<string, string> = {}
    for (const conceptId of validConceptIds)
      contentVersions[conceptId] = catalog.require(conceptId).version
    migratedTracks.push({
      id: track.id,
      goal: track.goal,
      conceptIds: validConceptIds,
      contentVersions,
      adjustments: [],
      createdAt: track.createdAt,
      recordedRevision: 1,
    })
  }

  if (migratedTracks.length === 0)
    return null

  const migratedActiveTrackId = migratedTracks.some(t => t.id === parsed.data.activeTrackId)
    ? parsed.data.activeTrackId
    : migratedTracks.at(-1)?.id ?? null

  const candidate: ClassroomSnapshot = {
    ...createEmptyClassroom(),
    revision: 1,
    activeTrackId: migratedActiveTrackId,
    tracks: migratedTracks,
    teacherExposureEpoch: parsed.data.teacherExposureEpoch
      ? {
          ...parsed.data.teacherExposureEpoch,
          recordedRevision: 1,
        }
      : null,
  }

  try {
    const validated = classroomSnapshotSchema.parse(candidate)
    await assertClassroomDiagnosticIntegrity(validated)
    assertClassroomIntegrity(validated, catalog)
    return validated
  }
  catch {
    return null
  }
}

export function selectMostRecentLegacyScope(
  scopes: readonly ClassroomScopeRecord[],
  currentScope: string,
): ClassroomScopeRecord | null {
  const candidates = scopes
    .filter(record => record.scope !== currentScope && hasClassroomActivity(record.snapshot))
    .sort((left, right) => snapshotActivityScore(right.snapshot) - snapshotActivityScore(left.snapshot))
  return candidates[0] ?? null
}

/**
 * Builds a portable, credential-free JSON snapshot of the AI Classroom
 * workspace (classroom state, Playground drafts, and preserved legacy course
 * backups). Never includes API keys or LLM settings.
 */
export function buildWorkspaceSnapshotBundle({
  classroomSnapshot,
  courseVersion,
  exportedAt = new Date().toISOString(),
  legacyClassrooms = [],
  playgroundTabs,
}: {
  classroomSnapshot: ClassroomSnapshot
  courseVersion: string
  exportedAt?: string
  legacyClassrooms?: readonly ClassroomScopeRecord[]
  playgroundTabs: ReadonlyArray<{ id: string, title: string, code: string }>
}): WorkspaceSnapshotBundle {
  return workspaceSnapshotBundleSchema.parse({
    format: WORKSPACE_SNAPSHOT_FORMAT,
    version: WORKSPACE_SNAPSHOT_VERSION,
    exportedAt,
    courseVersion,
    classroom: structuredClone(classroomSnapshot),
    playground: {
      tabs: playgroundTabs.map(tab => ({
        id: tab.id,
        title: tab.title,
        code: tab.code,
      })),
    },
    ...(legacyClassrooms.length > 0
      ? {
          legacyClassrooms: legacyClassrooms.map(item => ({
            scope: item.scope,
            snapshot: structuredClone(item.snapshot),
          })),
        }
      : {}),
  })
}

export type WorkspaceSnapshotImportParseResult
  = | {
    ok: true
    bundle: WorkspaceSnapshotBundle
    classroomToImport: ClassroomSnapshot
    migrated: boolean
  }
  | {
    ok: false
    reason: 'too_large' | 'invalid_json' | 'invalid_schema' | 'incompatible_course_version'
    detail?: string
  }

export async function parseWorkspaceSnapshotImport(
  rawJson: string,
  catalog: ContentPackCatalog,
): Promise<WorkspaceSnapshotImportParseResult> {
  if (utf8ByteLength(rawJson) > MAX_WORKSPACE_IMPORT_BYTES)
    return { ok: false, reason: 'too_large' }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(rawJson)
  }
  catch (error) {
    return {
      ok: false,
      reason: 'invalid_json',
      detail: error instanceof Error ? error.message : String(error),
    }
  }

  const parsedBundle = workspaceSnapshotBundleSchema.safeParse(parsedJson)
  if (!parsedBundle.success) {
    return {
      ok: false,
      reason: 'invalid_schema',
      detail: parsedBundle.error.issues[0]?.message,
    }
  }

  const bundle = parsedBundle.data
  try {
    await assertClassroomDiagnosticIntegrity(bundle.classroom)
    assertClassroomIntegrity(bundle.classroom, catalog)
    return {
      ok: true,
      bundle,
      classroomToImport: structuredClone(bundle.classroom),
      migrated: false,
    }
  }
  catch {
    if (!hasClassroomActivity(bundle.classroom)) {
      return {
        ok: true,
        bundle,
        classroomToImport: createEmptyClassroom(),
        migrated: false,
      }
    }
    const migrated = await migrateCompatibleClassroomSnapshot(bundle.classroom, catalog)
    if (migrated) {
      return {
        ok: true,
        bundle,
        classroomToImport: migrated,
        migrated: true,
      }
    }
    return { ok: false, reason: 'incompatible_course_version' }
  }
}
