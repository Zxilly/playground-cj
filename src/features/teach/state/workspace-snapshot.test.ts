import { describe, expect, it } from 'vitest'
import { createContentPackCatalog } from '@/lib/teach/classroom/content-catalog'
import type { CourseContentPack } from '@/lib/teach/classroom/content-packs'
import { createEmptyClassroom } from '@/lib/teach/classroom/state'
import {
  buildWorkspaceSnapshotBundle,
  migrateCompatibleClassroomSnapshot,
  parseWorkspaceSnapshotImport,
  WORKSPACE_SNAPSHOT_FORMAT,
  WORKSPACE_SNAPSHOT_VERSION,
} from './workspace-snapshot'

function makePack(
  conceptId: string,
  versionChar: string,
  prerequisites: string[] = [],
): CourseContentPack {
  const version = `cv:sha256:${versionChar.repeat(64)}`
  return {
    id: `pack:${conceptId}`,
    version,
    learningContractVersion: `lc:sha256:${'b'.repeat(64)}`,
    concept: {
      id: conceptId,
      title: `Title for ${conceptId}`,
      summary: `Summary for ${conceptId}`,
      prerequisites,
    },
    blocks: [{
      id: `block:${conceptId}:intro`,
      type: 'prose',
      markdown: `Intro for ${conceptId}`,
      sourceReferences: [{
        sourceId: 'static-tour',
        ref: `01-basics/${conceptId}/01`,
        title: conceptId,
      }],
    }],
    learningSkills: [{
      id: `skill:${conceptId}`,
      conceptId,
      title: `Skill ${conceptId}`,
      description: `Description ${conceptId}`,
      key: true,
    }],
    exerciseTemplates: [{
      id: `template:${conceptId}:practice`,
      version,
      learningSkillId: `skill:${conceptId}`,
      purpose: 'practice',
      task: {
        type: 'code_output',
        prompt: 'Print ok',
        starterCode: 'main() {}',
        expectedOutput: 'ok',
        matchMode: 'exact',
        sourceRequirements: [{ type: 'top_level_main' }],
        hints: [],
      },
    }],
  }
}

describe('workspace snapshot export, import, and safe migration', () => {
  it('builds a credential-free export bundle and re-imports it cleanly', async () => {
    const catalog = createContentPackCatalog([makePack('cj.program.main', 'a')])
    const classroom = {
      ...createEmptyClassroom(),
      revision: 1,
      activeTrackId: 'track:1',
      tracks: [{
        id: 'track:1',
        goal: 'Master main',
        conceptIds: ['cj.program.main'],
        contentVersions: { 'cj.program.main': `cv:sha256:${'a'.repeat(64)}` },
        adjustments: [],
        createdAt: 1000,
        recordedRevision: 1,
      }],
    }
    const bundle = buildWorkspaceSnapshotBundle({
      classroomSnapshot: classroom,
      courseVersion: 'course:sha256:test',
      playgroundTabs: [{
        id: 'tab-1',
        title: 'hello.cj',
        code: 'main() { println("hi") }',
      }],
    })

    expect(bundle.format).toBe(WORKSPACE_SNAPSHOT_FORMAT)
    expect(bundle.version).toBe(WORKSPACE_SNAPSHOT_VERSION)
    expect(JSON.stringify(bundle)).not.toContain('apiKey')

    const parsed = await parseWorkspaceSnapshotImport(JSON.stringify(bundle), catalog)
    expect(parsed).toMatchObject({
      ok: true,
      migrated: false,
      classroomToImport: classroom,
    })
  })

  it('rejects malformed JSON and invalid schemas without throwing', async () => {
    const catalog = createContentPackCatalog([makePack('cj.program.main', 'a')])

    expect(await parseWorkspaceSnapshotImport('{not-json', catalog)).toMatchObject({
      ok: false,
      reason: 'invalid_json',
    })
    expect(await parseWorkspaceSnapshotImport(JSON.stringify({ format: 'other' }), catalog)).toMatchObject({
      ok: false,
      reason: 'invalid_schema',
    })
  })

  it('migrates compatible learning tracks when course content versions upgrade', async () => {
    const newCatalog = createContentPackCatalog([
      makePack('cj.program.main', 'c'),
      makePack('cj.io.println', 'd', ['cj.program.main']),
    ])
    const legacySnapshot = {
      ...createEmptyClassroom(),
      revision: 4,
      activeTrackId: 'track:old',
      tracks: [{
        id: 'track:old',
        goal: 'Learn printing',
        conceptIds: ['cj.program.main', 'cj.io.println', 'cj.removed.concept'],
        contentVersions: {
          'cj.program.main': `cv:sha256:${'a'.repeat(64)}`,
          'cj.io.println': `cv:sha256:${'b'.repeat(64)}`,
          'cj.removed.concept': `cv:sha256:${'e'.repeat(64)}`,
        },
        adjustments: [],
        createdAt: 2000,
        recordedRevision: 1,
      }],
    }

    const migrated = await migrateCompatibleClassroomSnapshot(legacySnapshot, newCatalog)
    expect(migrated).not.toBeNull()
    expect(migrated?.activeTrackId).toBe('track:old')
    expect(migrated?.tracks).toHaveLength(1)
    expect(migrated?.tracks[0]?.conceptIds).toEqual(['cj.program.main', 'cj.io.println'])
    expect(migrated?.tracks[0]?.contentVersions).toEqual({
      'cj.program.main': `cv:sha256:${'c'.repeat(64)}`,
      'cj.io.println': `cv:sha256:${'d'.repeat(64)}`,
    })
  })
})
