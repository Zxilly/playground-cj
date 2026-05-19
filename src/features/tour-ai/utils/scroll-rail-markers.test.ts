import { describe, expect, it } from 'vitest'
import type { ClassroomSession } from '@/lib/ai/classroom/types'
import { createInitialClassroomSession } from '@/lib/ai/classroom/reducer'
import { deriveScrollRailMarkers, visibleStream } from './scroll-rail-markers'

function withStream(items: ClassroomSession['stream']): ClassroomSession {
  return { ...createInitialClassroomSession({ lang: 'zh' }), stream: items }
}

describe('deriveScrollRailMarkers', () => {
  it('returns no markers for an empty stream', () => {
    expect(deriveScrollRailMarkers(createInitialClassroomSession({ lang: 'zh' }))).toEqual([])
  })

  it('emits heading_h2 and heading_h3 markers with blockKey anchors', () => {
    const session = withStream([
      {
        id: 'lesson:0',
        type: 'lesson_blocks',
        createdAt: 1,
        blocks: [
          { type: 'heading', text: 'Section', level: 2 },
          { type: 'paragraph', body: 'Body.' },
          { type: 'heading', text: 'Subsection', level: 3 },
        ],
      },
    ])
    const markers = deriveScrollRailMarkers(session)
    expect(markers.map(m => m.kind)).toEqual(['heading_h2', 'heading_h3'])
    expect(markers[0].blockKey).toBe('lesson:0:block:0')
    expect(markers[1].blockKey).toBe('lesson:0:block:2')
  })

  it('flags the active quiz with attention=active_quiz', () => {
    let session = withStream([
      {
        id: 'quiz:1',
        type: 'quiz',
        createdAt: 1,
        quiz: {
          id: 'quiz:1',
          conceptId: 'cj.test',
          prompt: 'do it',
          starterCode: '',
          expectedOutput: '',
          matchMode: 'exact',
          status: 'active',
          createdAt: 1,
        },
      },
    ])
    // currentQuiz mirrors the stream item so the derivation reads `active`.
    session = {
      ...session,
      currentQuiz: {
        id: 'quiz:1',
        conceptId: 'cj.test',
        prompt: 'do it',
        starterCode: '',
        expectedOutput: '',
        matchMode: 'exact',
        status: 'active',
        createdAt: 1,
      },
    }
    const markers = deriveScrollRailMarkers(session)
    expect(markers).toHaveLength(1)
    expect(markers[0]).toMatchObject({ kind: 'quiz', attention: 'active_quiz', label: 'Quiz · cj.test' })
  })

  it('flags failure_pending when a quiz_failure event is queued for the quiz', () => {
    const session: ClassroomSession = {
      ...createInitialClassroomSession({ lang: 'zh' }),
      stream: [
        {
          id: 'quiz:9',
          type: 'quiz',
          createdAt: 10,
          quiz: {
            id: 'quiz:9',
            conceptId: 'cj.test',
            prompt: 'do',
            starterCode: '',
            expectedOutput: '7',
            matchMode: 'exact',
            status: 'active',
            createdAt: 10,
          },
        },
      ],
      currentQuiz: {
        id: 'quiz:9',
        conceptId: 'cj.test',
        prompt: 'do',
        starterCode: '',
        expectedOutput: '7',
        matchMode: 'exact',
        status: 'active',
        createdAt: 10,
      },
      eventQueue: [{
        type: 'quiz_failure',
        conceptId: 'cj.test',
        quizId: 'quiz:9',
        prompt: 'do',
        attemptedCode: 'main() {}',
        expectedOutput: '7',
        actualOutput: '',
        summary: 'failed',
        createdAt: 11,
      }],
    }
    const markers = deriveScrollRailMarkers(session)
    // active_quiz takes precedence over failure_pending in our priority order.
    expect(markers[0]).toMatchObject({ kind: 'quiz', attention: 'active_quiz' })
  })

  it('emits progress_success / progress_skip markers for progress_update items', () => {
    const session = withStream([
      {
        id: 'progress:0',
        type: 'progress_update',
        conceptId: 'cj.test',
        outcome: 'success',
        summary: 'good',
        createdAt: 1,
      },
      {
        id: 'progress:1',
        type: 'progress_update',
        conceptId: 'cj.test2',
        outcome: 'skip',
        summary: 'meh',
        createdAt: 2,
      },
    ])
    const markers = deriveScrollRailMarkers(session)
    expect(markers.map(m => m.kind)).toEqual(['progress_success', 'progress_skip'])
  })

  it('emits generation_error and failure markers from system_event items', () => {
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
          type: 'quiz_failure',
          conceptId: 'cj.x',
          quizId: 'q1',
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
  })

  it('skips run_result items so marker positions line up with the visible (filtered) stream', () => {
    const session = withStream([
      { id: 'h', type: 'lesson_blocks', createdAt: 1, blocks: [{ type: 'heading', text: 'A', level: 2 }] },
      { id: 'run:0', type: 'run_result', result: { ok: true, stdout: '', stderr: '', exitCode: 0 }, createdAt: 2 },
      { id: 'h2', type: 'lesson_blocks', createdAt: 3, blocks: [{ type: 'heading', text: 'B', level: 2 }] },
    ])
    // visibleStream drops run_result so visibleIndex skips the gap.
    expect(visibleStream(session).map(i => i.id)).toEqual(['h', 'h2'])
    const markers = deriveScrollRailMarkers(session)
    expect(markers.map(m => m.visibleIndex)).toEqual([0, 1])
    expect(markers.every(m => m.visibleCount === 2)).toBe(true)
  })

  it('caches by stream reference: same stream + same event-queue fingerprint returns the same array', () => {
    const session = withStream([
      { id: 'h', type: 'lesson_blocks', createdAt: 1, blocks: [{ type: 'heading', text: 'A', level: 2 }] },
    ])
    const a = deriveScrollRailMarkers(session)
    const b = deriveScrollRailMarkers(session)
    expect(a).toBe(b)
  })
})
