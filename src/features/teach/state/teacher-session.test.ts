import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AIClassroom } from '@/lib/teach/classroom/ai-classroom'
import { createEmptyClassroom } from '@/lib/teach/classroom/state'
import { createTeacherSessionRuntime } from './teacher-session'

const mocks = vi.hoisted(() => ({
  createTransport: vi.fn((
    _agent: unknown,
    _signal: AbortSignal,
    _boundary?: unknown,
    _prepareTurn?: unknown,
  ) => ({})),
  ensureFirstLessonScaffold: vi.fn(async () => undefined),
}))

vi.mock('@/lib/teach/teacher/first-lesson-scaffold', () => ({
  ensureFirstLessonScaffold: mocks.ensureFirstLessonScaffold,
}))

vi.mock('@/lib/teach/teacher/toolkit', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/lib/teach/teacher/toolkit')
  >()
  return {
    ...actual,
    createRemediationToolkit: vi.fn(() => ({})),
    createTeacherToolkit: vi.fn(() => ({})),
  }
})
vi.mock('@/lib/teach/teacher/agent', () => ({
  createRemediationAgent: vi.fn(() => ({ generate: vi.fn() })),
  createTeacherAgent: vi.fn(() => ({ generate: vi.fn() })),
}))
vi.mock('@/lib/teach/teacher/scoped-chat-transport', () => ({
  createScopedChatTransport: mocks.createTransport,
}))

describe('teacher session runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('owns its scope signal and Classroom subscription until disposal', () => {
    const unsubscribe = vi.fn()
    const classroom = {
      snapshot: () => createEmptyClassroom(),
      subscribe: vi.fn(() => unsubscribe),
      execute: vi.fn(),
    } as unknown as AIClassroom
    const workspaceController = new AbortController()
    const runtime = createTeacherSessionRuntime()

    const session = runtime.open({
      activeEditor: {} as never,
      catalog: {} as never,
      classroom,
      config: {},
      knowledge: {} as never,
      lang: 'en',
      listPlaygroundTabs: () => [],
      now: () => 1_000,
      scope: { mode: 'live', learningTrackId: null },
      workspaceSignal: workspaceController.signal,
    })
    const scopeSignal = mocks.createTransport.mock.calls[0]?.[1]

    expect(scopeSignal?.aborted).toBe(false)
    expect(classroom.subscribe).toHaveBeenCalledOnce()

    session.dispose()
    session.dispose()

    expect(scopeSignal?.aborted).toBe(true)
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('disposes the session when the workspace signal aborts', () => {
    const unsubscribe = vi.fn()
    const classroom = {
      snapshot: () => createEmptyClassroom(),
      subscribe: vi.fn(() => unsubscribe),
      execute: vi.fn(),
    } as unknown as AIClassroom
    const workspaceController = new AbortController()
    const session = createTeacherSessionRuntime().open({
      activeEditor: {} as never,
      catalog: {} as never,
      classroom,
      config: {},
      knowledge: {} as never,
      lang: 'en',
      listPlaygroundTabs: () => [],
      now: () => 1_000,
      scope: { mode: 'live', learningTrackId: null },
      workspaceSignal: workspaceController.signal,
    })
    const scopeSignal = mocks.createTransport.mock.calls.at(-1)?.[1]

    workspaceController.abort(
      new DOMException('Workspace closed', 'AbortError'),
    )

    expect(scopeSignal?.aborted).toBe(true)
    expect(unsubscribe).toHaveBeenCalledOnce()

    session.dispose()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('finalizes an explicitly prepared empty first lesson before releasing text', async () => {
    let snapshot = {
      ...createEmptyClassroom(),
      activeTrackId: 'track:first',
      tracks: [{
        id: 'track:first',
        goal: 'Learn main.',
        conceptIds: ['cj.program.main'],
        contentVersions: {
          'cj.program.main': `cv:sha256:${'a'.repeat(64)}`,
        },
        createdAt: 1,
        recordedRevision: 1,
        adjustments: [],
      }],
    }
    const classroom = {
      snapshot: () => snapshot,
      subscribe: vi.fn(() => vi.fn()),
      execute: vi.fn(async (command) => {
        if (command.type === 'record_teacher_exposure') {
          snapshot = {
            ...snapshot,
            teacherExposureEpoch: {
              id: 'exposure:first',
              interactionId: command.interactionId,
              createdAt: 2,
              recordedRevision: 2,
            },
          }
        }
        return snapshot
      }),
    } as unknown as AIClassroom
    const session = createTeacherSessionRuntime().open({
      activeEditor: {} as never,
      catalog: {} as never,
      classroom,
      config: {},
      knowledge: {} as never,
      lang: 'en',
      listPlaygroundTabs: () => [],
      now: () => 1_000,
      scope: { mode: 'live', learningTrackId: 'track:first' },
      workspaceSignal: new AbortController().signal,
    })
    const outputBoundary = mocks.createTransport.mock.calls.at(-1)?.[2] as
      | { commit: (signal: AbortSignal) => Promise<void> }
      | undefined
    const prepareTurn = mocks.createTransport.mock.calls.at(-1)?.[3] as
      | ((
        signal: AbortSignal,
        request: {
          trigger: 'submit-message' | 'regenerate-message'
          messageId: string | undefined
          metadata: unknown
        },
      ) => void | (() => void))
      | undefined
    const turnSignal = new AbortController().signal
    const cleanupTurn = prepareTurn?.(turnSignal, {
      trigger: 'submit-message',
      messageId: 'message:first',
      metadata: {
        custom: {
          teacherIntent: 'first_lesson',
          teacherLearningTrackId: 'track:first',
        },
      },
    })

    await outputBoundary?.commit(turnSignal)

    expect(mocks.ensureFirstLessonScaffold).toHaveBeenCalledWith({
      catalog: expect.anything(),
      classroom,
      learningTrackId: 'track:first',
      turnSignal,
    })
    expect(classroom.execute).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'record_teacher_exposure' }),
      expect.anything(),
    )

    cleanupTurn?.()
    session.dispose()
  })
})
