import { describe, expect, it } from 'vitest'
import { classroomReducer, createInitialClassroomSession } from '@/lib/ai/classroom/reducer'
import type { ClassroomAction } from '@/lib/ai/classroom/reducer'
import type { ClassroomSession } from '@/lib/ai/classroom/types'
import { deriveScrollRailMarkers, visibleStream } from './scroll-rail-markers'

const exerciseAction: Extract<ClassroomAction, { type: 'CREATE_EXERCISE_INSTANCE' }> = {
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

function withStream(items: ClassroomSession['stream']): ClassroomSession {
  return { ...createInitialClassroomSession({ lang: 'zh' }), stream: items }
}

describe('deriveScrollRailMarkers', () => {
  it('returns no markers for an empty stream', () => {
    expect(deriveScrollRailMarkers(createInitialClassroomSession({ lang: 'zh' }))).toEqual([])
  })

  it('emits heading markers from content reference groups', () => {
    let session = createInitialClassroomSession({ lang: 'zh' })
    session = classroomReducer(session, {
      type: 'APPEND_CONTENT_REFERENCE_GROUP',
      conceptId: 'cj.program.main',
      blockIds: ['cj.program.main.heading', 'cj.program.main.shape'],
      now: 1001,
    })

    const markers = deriveScrollRailMarkers(session)
    expect(markers).toEqual([
      expect.objectContaining({
        kind: 'heading_h2',
        label: '程序入口与 main',
        blockKey: 'content-group:1001:0:block:0',
      }),
    ])
  })

  it('flags the active exercise with attention=active_exercise', () => {
    const session = classroomReducer(createInitialClassroomSession({ lang: 'zh' }), exerciseAction)

    expect(deriveScrollRailMarkers(session)).toEqual([
      expect.objectContaining({
        kind: 'exercise',
        attention: 'active_exercise',
        label: '练习',
      }),
    ])
  })

  it('labels review check exercise and evidence markers distinctly', () => {
    let session = classroomReducer(createInitialClassroomSession({ lang: 'zh' }), {
      ...exerciseAction,
      exercise: {
        ...exerciseAction.exercise,
        intent: 'review_check',
      },
    })
    session = classroomReducer(session, {
      type: 'EXERCISE_SUBMIT_FINISHED',
      result: { ok: true, stdout: 'Cangjie\n', stderr: '', exitCode: 0 },
      now: 1003,
    })

    expect(deriveScrollRailMarkers(session).map(marker => marker.label)).toEqual([
      '复习检查',
      '复习检查通过，已记录掌握证据',
    ])
  })

  it('emits progress and retention markers', () => {
    let session = classroomReducer(createInitialClassroomSession({ lang: 'zh' }), exerciseAction)
    session = classroomReducer(session, {
      type: 'EXERCISE_SUBMIT_FINISHED',
      result: { ok: true, stdout: 'Cangjie\n', stderr: '', exitCode: 0 },
      now: 1003,
    })
    session = classroomReducer(session, {
      type: 'SAVE_REVIEW_ARTIFACT',
      artifact: {
        kind: 'clarification',
        conceptId: 'cj.io.println',
        title: 'Print',
        body: 'Use println.',
        summary: 'println reminder',
        evidenceIds: [],
      },
      now: 1004,
    })

    expect(deriveScrollRailMarkers(session).map(m => m.kind)).toEqual([
      'exercise',
      'progress_success',
      'retained',
    ])
  })

  it('marks failed attempt evidence as a failure target instead of completed progress', () => {
    let session = classroomReducer(createInitialClassroomSession({ lang: 'zh' }), exerciseAction)
    session = classroomReducer(session, {
      type: 'EXERCISE_SUBMIT_FINISHED',
      result: { ok: true, stdout: 'wrong\n', stderr: '', exitCode: 0 },
      attemptedCode: 'main() {}',
      now: 1003,
    })

    expect(deriveScrollRailMarkers(session).map(marker => ({
      kind: marker.kind,
      label: marker.label,
    }))).toEqual([
      { kind: 'exercise', label: '练习' },
      { kind: 'failure', label: '练习尝试未通过' },
    ])
  })

  it('emits generation_error and failure markers from system events', () => {
    const session = withStream([
      {
        id: 'sys:0',
        type: 'system_event',
        createdAt: 1,
        event: { type: 'lesson_generation_error', summary: 'oops', createdAt: 1 },
      },
      {
        id: 'sys:1',
        type: 'system_event',
        createdAt: 2,
        event: {
          type: 'exercise_failure',
          exerciseInstanceId: 'exercise:1',
          templateId: 't1',
          skillId: 's1',
          conceptIds: ['cj.x'],
          prompt: 'p',
          attemptedCode: '',
          expectedOutput: '',
          actualOutput: '',
          summary: 'bad',
          createdAt: 2,
        },
      },
    ])

    const markers = deriveScrollRailMarkers(session)
    expect(markers.map(m => m.kind)).toEqual(['generation_error', 'failure'])
    expect(markers.at(-1)?.label).toBe('练习需要再检查')
  })

  it('skips run_result items so marker positions line up with the visible stream', () => {
    const session = withStream([
      {
        id: 'content:0',
        type: 'content_reference_group',
        groupId: 'group:0',
        conceptId: 'cj.program.main',
        references: [{
          packId: 'default-entry',
          contentVersion: '2026-05-28',
          blockId: 'cj.program.main.heading',
          conceptId: 'cj.program.main',
        }],
        createdAt: 1,
      },
      { id: 'run:0', type: 'run_result', result: { ok: true, stdout: '', stderr: '', exitCode: 0 }, createdAt: 2 },
      {
        id: 'content:1',
        type: 'content_reference_group',
        groupId: 'group:1',
        conceptId: 'cj.io.println',
        references: [{
          packId: 'default-entry',
          contentVersion: '2026-05-28',
          blockId: 'cj.io.println.heading',
          conceptId: 'cj.io.println',
        }],
        createdAt: 3,
      },
    ])

    expect(visibleStream(session).map(i => i.id)).toEqual(['content:0', 'content:1'])
    const markers = deriveScrollRailMarkers(session)
    expect(markers.map(m => m.visibleIndex)).toEqual([0, 1])
    expect(markers.every(m => m.visibleCount === 2)).toBe(true)
  })
})
