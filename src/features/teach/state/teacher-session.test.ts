import { describe, expect, it, vi } from 'vitest'
import type { AIClassroom } from '@/lib/teach/classroom/ai-classroom'
import { createEmptyClassroom } from '@/lib/teach/classroom/state'
import { createTeacherSessionRuntime } from './teacher-session'

const mocks = vi.hoisted(() => ({
  createTransport: vi.fn((_agent: unknown, _signal: AbortSignal) => ({})),
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
})
