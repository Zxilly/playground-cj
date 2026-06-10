import { describe, expect, it } from 'vitest'
import { classroomReducer, createInitialClassroomSession } from './reducer'
import { deriveLiveViewChapterIndex, projectClassroomLiveView, projectClassroomLiveViewSurface, projectClassroomReviewView } from './view-projections'
import type { ClassroomAction } from './reducer'
import { getDefaultCourseContentIndex } from '@/lib/ai/course-content/loader'

const exerciseAction: ClassroomAction = {
  type: 'CREATE_EXERCISE_INSTANCE',
  exercise: {
    templateId: 'cj.io.println.print-value.cangjie',
    templateVersion: '2026-05-28',
    skillId: 'cj.io.println.print-value',
    conceptIds: ['cj.io.println'],
    prompt: 'Print Cangjie.',
    starterCode: '',
    expectedOutput: 'Cangjie',
    matchMode: 'exact',
    intent: 'mainline',
    personalizationInputs: { summary: 'test' },
  },
  now: 1002,
}

function withConceptStatus<T>(conceptId: string, status: 'validated' | 'read_only' | 'invalid', callback: () => T): T {
  const statuses = getDefaultCourseContentIndex().validation.conceptStatuses
  const previous = statuses[conceptId]
  statuses[conceptId] = status
  try {
    return callback()
  }
  finally {
    statuses[conceptId] = previous
  }
}

describe('projectClassroomLiveView', () => {
  it('keeps Live View time ordered while resolving Core Content references for rendering', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
    session = classroomReducer(session, {
      type: 'APPEND_CONTENT_REFERENCE_GROUP',
      conceptId: 'cj.io.println',
      blockIds: ['cj.io.println.heading', 'cj.io.println.output'],
      now: 1001,
    })
    session = classroomReducer(session, exerciseAction)
    session = classroomReducer(session, {
      type: 'EXERCISE_RUN_FINISHED',
      result: { ok: true, stdout: 'Cangjie\n', stderr: '', exitCode: 0 },
      now: 1003,
    })

    const liveView = projectClassroomLiveView(session)

    expect(liveView.items.map(item => item.type)).toEqual([
      'content_reference_group',
      'exercise_instance',
      'run_result',
    ])
    expect(liveView.visibleItems.map(item => item.type)).toEqual([
      'content_reference_group',
      'exercise_instance',
    ])
    expect(liveView.visibleItems[0]).toMatchObject({
      heading: '标准输出 println',
      resolvedBlocks: [
        expect.objectContaining({
          blockId: 'cj.io.println.heading',
          encounteredContentVersion: '2026-05-28',
          content: expect.objectContaining({ type: 'heading', text: '标准输出 println' }),
        }),
        expect.objectContaining({
          blockId: 'cj.io.println.output',
          content: expect.objectContaining({ type: 'paragraph' }),
        }),
      ],
    })
    expect(liveView.latestRunByExercise.get(session.currentExercise!.id)).toMatchObject({
      stdout: 'Cangjie\n',
    })
  })

  it('derives chapter anchors from the Live View projection', () => {
    let session = createInitialClassroomSession({ lang: 'en' })
    session = classroomReducer(session, {
      type: 'APPEND_CONTENT_REFERENCE_GROUP',
      conceptId: 'cj.program.main',
      blockIds: ['cj.program.main.heading', 'cj.program.main.shape'],
      now: 1001,
    })

    expect(deriveLiveViewChapterIndex(projectClassroomLiveView(session))).toEqual([
      expect.objectContaining({
        text: 'Program entry and main',
        blockKey: 'content-group:1001:0:block:0',
      }),
    ])
  })

  it('projects a cohesive Live View surface for scroll consumers', () => {
    let session = createInitialClassroomSession({ lang: 'en' })
    session = classroomReducer(session, {
      type: 'APPEND_CONTENT_REFERENCE_GROUP',
      conceptId: 'cj.program.main',
      blockIds: ['cj.program.main.heading', 'cj.program.main.shape'],
      now: 1001,
    })
    session = classroomReducer(session, exerciseAction)
    session = classroomReducer(session, {
      type: 'EXERCISE_RUN_FINISHED',
      result: { ok: true, stdout: 'Cangjie\n', stderr: '', exitCode: 0 },
      now: 1003,
    })

    const surface = projectClassroomLiveViewSurface(session)

    expect(surface.visibleCount).toBe(2)
    expect(surface.visibleItems.map(item => item.type)).toEqual(['content_reference_group', 'exercise_instance'])
    expect(surface.chapterEntries).toEqual([
      expect.objectContaining({
        text: 'Program entry and main',
        blockKey: 'content-group:1001:0:block:0',
      }),
    ])
    expect(surface.blockTargetsByKey.get('content-group:1001:0:block:0')).toMatchObject({
      visibleIndex: 0,
      streamItemId: 'content-group:1001:0',
    })
    expect(surface.exerciseTargetsById.get(session.currentExercise!.id)).toMatchObject({
      visibleIndex: 1,
      streamItemId: session.currentExercise!.id,
    })
    expect(surface.latestRunByExercise.get(session.currentExercise!.id)).toMatchObject({
      stdout: 'Cangjie\n',
    })
  })
})

describe('projectClassroomReviewView', () => {
  it('organizes Review View by concept with exposure and retained artifacts', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
    session = classroomReducer(session, {
      type: 'APPEND_CONTENT_REFERENCE_GROUP',
      conceptId: 'cj.io.println',
      blockIds: ['cj.io.println.heading'],
      now: 1001,
    })
    session = classroomReducer(session, {
      type: 'APPEND_SKIP_MARKER',
      conceptId: 'cj.io.println',
      blockIds: ['cj.io.println.output'],
      reason: 'Placement check showed this can be skipped.',
      now: 1002,
    })
    session = classroomReducer(session, {
      type: 'SAVE_REVIEW_ARTIFACT',
      artifact: {
        artifactId: 'keep-me',
        kind: 'clarification',
        conceptId: 'cj.io.println',
        title: 'Print reminder',
        body: 'Use println for stdout.',
        summary: 'println reminder',
        evidenceIds: [],
      },
      now: 1003,
    })
    session = classroomReducer(session, {
      type: 'SAVE_REVIEW_ARTIFACT',
      artifact: {
        artifactId: 'remove-me',
        kind: 'clarification',
        conceptId: 'cj.io.println',
        title: 'Old note',
        body: 'Remove this.',
        summary: 'old note',
        evidenceIds: [],
      },
      now: 1004,
    })
    session = classroomReducer(session, {
      type: 'REMOVE_REVIEW_ARTIFACT',
      artifactId: 'remove-me',
      now: 1005,
    })

    const reviewView = projectClassroomReviewView(session, 'en')
    const concept = reviewView.concepts.find(item => item.conceptId === 'cj.io.println')

    expect(reviewView).toMatchObject({
      packId: 'default-entry',
      contentVersion: '2026-05-28',
      activeTrackId: 'default-entry',
    })
    expect(concept).toMatchObject({
      title: 'Standard output println',
      exposureStatus: 'seen',
      progress: expect.objectContaining({
        status: 'seen',
        readiness: 'ready_for_practice',
      }),
      blocks: [
        expect.objectContaining({
          blockId: 'cj.io.println.heading',
          exposureStatus: 'seen',
          content: expect.objectContaining({ type: 'heading', text: 'Standard output println' }),
        }),
        expect.objectContaining({
          blockId: 'cj.io.println.output',
          exposureStatus: 'skipped',
        }),
      ],
      artifactGroups: [
        expect.objectContaining({ artifactIds: ['keep-me'] }),
      ],
      retainedItemControls: [
        expect.objectContaining({ artifactId: 'keep-me' }),
      ],
    })
  })

  it('carries derived concept progress into the Review View projection', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
    session = classroomReducer(session, exerciseAction)
    session = classroomReducer(session, {
      type: 'EXERCISE_SUBMIT_FINISHED',
      result: { ok: true, stdout: 'wrong\n', stderr: '', exitCode: 0 },
      attemptedCode: 'main() {\n    println("wrong")\n}',
      now: 1003,
    })
    session = classroomReducer(session, {
      type: 'EXERCISE_SUBMIT_FINISHED',
      result: { ok: true, stdout: 'still wrong\n', stderr: '', exitCode: 0 },
      attemptedCode: 'main() {\n    println("still wrong")\n}',
      now: 1004,
    })

    const concept = projectClassroomReviewView(session).concepts.find(item => item.conceptId === 'cj.io.println')

    expect(concept?.progress).toMatchObject({
      status: 'blocked',
      readiness: 'needs_remediation',
      blockerExplanation: '这项练习已连续 2 次未通过，建议先看相关提示再试一次。',
    })
  })

  it('projects read-only concepts without practice readiness', () => {
    withConceptStatus('cj.io.println', 'read_only', () => {
      let session = createInitialClassroomSession({ lang: 'zh' })
      session = classroomReducer(session, {
        type: 'APPEND_CONTENT_REFERENCE_GROUP',
        conceptId: 'cj.io.println',
        blockIds: ['cj.io.println.heading'],
        now: 1001,
      })

      const concept = projectClassroomReviewView(session).concepts.find(item => item.conceptId === 'cj.io.println')

      expect(concept).toMatchObject({
        contentStatus: 'read_only',
        progress: expect.objectContaining({
          contentStatus: 'read_only',
          status: 'seen',
          readiness: 'review_only',
        }),
      })
    })
  })

  it('projects invalid concepts as unavailable instead of practice-ready', () => {
    withConceptStatus('cj.io.println', 'invalid', () => {
      let session = createInitialClassroomSession({ lang: 'zh' })
      session = classroomReducer(session, {
        type: 'APPEND_CONTENT_REFERENCE_GROUP',
        conceptId: 'cj.io.println',
        blockIds: ['cj.io.println.heading'],
        now: 1001,
      })

      const concept = projectClassroomReviewView(session).concepts.find(item => item.conceptId === 'cj.io.println')

      expect(concept).toMatchObject({
        contentStatus: 'invalid',
        progress: expect.objectContaining({
          contentStatus: 'invalid',
          status: 'seen',
          readiness: 'content_unavailable',
        }),
      })
    })
  })

  it('projects repeated Review Artifacts as concept-level groups', () => {
    let session = createInitialClassroomSession({ lang: 'en' })
    for (const artifact of [
      {
        artifactId: 'a1',
        kind: 'clarification' as const,
        conceptId: 'cj.io.println',
        title: 'Print reminder',
        body: 'Use println.',
        summary: 'print reminder',
        evidenceIds: [],
      },
      {
        artifactId: 'a2',
        kind: 'clarification' as const,
        conceptId: 'cj.io.println',
        title: 'Print reminder',
        body: 'println writes a newline.',
        summary: 'newline reminder',
        evidenceIds: [],
      },
    ]) {
      session = classroomReducer(session, {
        type: 'SAVE_REVIEW_ARTIFACT',
        artifact,
        emitMarker: false,
        now: artifact.artifactId === 'a1' ? 1001 : 1002,
      })
    }

    const concept = projectClassroomReviewView(session, 'en').concepts.find(item => item.conceptId === 'cj.io.println')

    expect(concept?.artifactGroups).toEqual([
      expect.objectContaining({
        kind: 'clarification_group',
        artifactIds: ['a1', 'a2'],
        body: 'Use println.\n\nprintln writes a newline.',
      }),
    ])
  })
})
