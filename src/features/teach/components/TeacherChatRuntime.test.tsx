import { act, cleanup, render, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceContextValue } from '@/features/teach/context/workspace-context'
import { WorkspaceContext } from '@/features/teach/context/workspace-context'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import { usePlaygroundSession } from '@/features/teach/state/playground-session'
import type { TeacherChatMessage } from '@/features/teach/state/teacher-session'
import { TeacherChatRuntime } from './TeacherChatRuntime'
import { createEmptyClassroom } from '@/lib/teach/classroom/state'
import type {
  AIClassroomExecutionOptions,
  ClassroomCommand,
} from '@/lib/teach/classroom/ai-classroom'

const mocks = vi.hoisted(() => ({
  abortSignal: new AbortController().signal,
  composerSendListeners: [] as Array<() => void>,
  composerRuntime: {
    getState: () => ({ text: '' }),
    setText: vi.fn<(text: string) => void>(),
    setRunConfig: vi.fn<(runConfig: Record<string, unknown>) => void>(),
    unstable_on: vi.fn((_event: string, listener: () => void) => {
      mocks.composerSendListeners.push(listener)
      return () => {
        const index = mocks.composerSendListeners.indexOf(listener)
        if (index >= 0)
          mocks.composerSendListeners.splice(index, 1)
      }
    }),
  },
  config: {},
  threadRunning: false,
  chatRuntimeOptions: [] as Array<{
    messages?: TeacherChatMessage[]
    onError?: (error: Error) => void
    onFinish?: (event: {
      isAbort?: boolean
      isError?: boolean
      messages: TeacherChatMessage[]
    }) => void
  }>,
  toolBudgetOpenSignals: [] as AbortSignal[],
  createToolkit: vi.fn((_deps: unknown) => ({})),
  generate: vi.fn(async (_options: {
    abortSignal: AbortSignal
    timeout?: number
  }): Promise<unknown> => ({})),
  createAgent: vi.fn((_config: unknown, _tools: unknown, _lang: unknown) => ({
    generate: mocks.generate,
  })),
  createTransport: vi.fn((
    _agent: unknown,
    _signal: unknown,
    _beforeTeacherText?: () => Promise<void>,
  ) => ({})),
}))

function createComposerRuntime(initialText = '') {
  let text = initialText
  return {
    getState: () => ({ text }),
    setText: vi.fn((nextText: string) => {
      text = nextText
    }),
    setRunConfig: vi.fn<(runConfig: Record<string, unknown>) => void>(),
    unstable_on: vi.fn((_event: string, listener: () => void) => {
      mocks.composerSendListeners.push(listener)
      return () => {
        const index = mocks.composerSendListeners.indexOf(listener)
        if (index >= 0)
          mocks.composerSendListeners.splice(index, 1)
      }
    }),
  }
}

/* eslint-disable react/component-hook-factories -- Vitest module factories intentionally provide hook and component test doubles. */
vi.mock('@assistant-ui/react', () => ({
  AssistantRuntimeProvider: ({ children }: { children: ReactNode }) => children,
  useComposerRuntime: () => mocks.composerRuntime,
  useAuiState: (selector: (state: { composer: { text: string }, thread: { isRunning: boolean, messages: never[] } }) => unknown) => selector({
    composer: mocks.composerRuntime.getState(),
    thread: { isRunning: mocks.threadRunning, messages: [] },
  }),
}))
vi.mock('@assistant-ui/react-ai-sdk', () => ({
  useChatRuntime: (options: {
    messages?: TeacherChatMessage[]
    onError?: (error: Error) => void
    onFinish?: (event: {
      isAbort?: boolean
      isError?: boolean
      messages: TeacherChatMessage[]
    }) => void
  }) => {
    mocks.chatRuntimeOptions.push(options)
    return {}
  },
}))
vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('@/modules/assistant-ui/chat/Thread', () => ({
  Thread: () => <div>thread</div>,
}))
vi.mock('@/lib/teach/teacher/toolkit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/teach/teacher/toolkit')>()
  return {
    ...actual,
    remediationDiagnosticContextAvailability: () => 'complete',
    createTeacherToolCallBudget: () => {
      const budget = actual.createTeacherToolCallBudget()
      return {
        ...budget,
        open: (
          signal: AbortSignal,
          limits: {
            total: number
            documentationSearches: number
          },
        ) => {
          mocks.toolBudgetOpenSignals.push(signal)
          return budget.open(signal, limits)
        },
      }
    },
    createTeacherToolkit: mocks.createToolkit,
  }
})
vi.mock('@/lib/teach/teacher/agent', () => ({
  createRemediationAgent: mocks.createAgent,
  createTeacherAgent: mocks.createAgent,
}))
vi.mock('@/lib/teach/teacher/scoped-chat-transport', () => ({
  createScopedChatTransport: mocks.createTransport,
}))
vi.mock('@/modules/llm-config/runtime/useLLMConfigBootstrap', () => ({
  useLLMConfigBootstrap: vi.fn(),
}))
vi.mock('@/stores/llmConfig', () => ({
  useLLMConfig: () => mocks.config,
  useLLMConfigStore: (selector: (state: unknown) => unknown) => selector({
    keySource: 'manual',
    autoQuota: null,
    setAutoQuota: vi.fn(),
  }),
}))
vi.mock('@/features/teach/context/abort-scope', () => ({
  useAbortScope: () => mocks.abortSignal,
}))
/* eslint-enable react/component-hook-factories */

let classroomSnapshot = createEmptyClassroom()
let currentNow = 123
let catalogConceptIds = ['cj.program.main']
const classroomListeners = new Set<() => void>()
function notifyClassroom() {
  classroomListeners.forEach(listener => listener())
}
const context = {
  catalog: {
    list: () => catalogConceptIds.map(conceptId => ({ conceptId })),
    get: (conceptId: string, contentVersion?: string) => {
      const currentVersion = 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      return catalogConceptIds.includes(conceptId)
        && (contentVersion === undefined || contentVersion === currentVersion)
        ? { version: currentVersion, concept: { id: conceptId } }
        : undefined
    },
  },
  classroom: {
    snapshot: () => classroomSnapshot,
    subscribe: (listener: () => void) => {
      classroomListeners.add(listener)
      return () => classroomListeners.delete(listener)
    },
    execute: vi.fn(),
  },
  knowledge: { id: 'docs', search: vi.fn() },
  activeEditor: { getCode: () => null },
  now: () => currentNow,
} as unknown as WorkspaceContextValue

beforeEach(() => {
  vi.clearAllMocks()
  mocks.composerSendListeners.length = 0
  mocks.composerRuntime = createComposerRuntime()
  mocks.threadRunning = false
  mocks.chatRuntimeOptions.length = 0
  mocks.toolBudgetOpenSignals.length = 0
  mocks.config = {}
  vi.mocked(context.classroom.execute).mockImplementation(
    async (command: ClassroomCommand) => {
      if (
        command.type === 'claim_remediation_diagnostic'
        || command.type === 'release_remediation_diagnostic_claim'
      ) {
        const artifact = classroomSnapshot.reviewArtifacts.find(
          candidate =>
            candidate.type === 'remediation'
            && candidate.id === command.job.artifactId,
        )
        if (artifact?.type === 'remediation') {
          const claim = artifact.diagnosticClaim ?? null
          if (command.type === 'claim_remediation_diagnostic') {
            const claimedAt = Math.max(currentNow, command.observedAt)
            if (!claim) {
              classroomSnapshot = {
                ...classroomSnapshot,
                revision: classroomSnapshot.revision + 1,
                reviewArtifacts: classroomSnapshot.reviewArtifacts.map(
                  candidate => candidate.id === artifact.id
                    ? {
                        ...artifact,
                        diagnosticClaim: {
                          job: command.job,
                          ownerNonce: command.ownerNonce,
                          claimedAt,
                          expiresAt: claimedAt + 45_000,
                        },
                        updatedAt: claimedAt,
                        updatedRevision: classroomSnapshot.revision + 1,
                      }
                    : candidate,
                ),
              }
            }
          }
          else if (
            claim
            && claim.ownerNonce === command.ownerNonce
            && claim.job.artifactId === command.job.artifactId
            && claim.job.failedAttemptId === command.job.failedAttemptId
            && claim.job.diagnosticAttempt === command.job.diagnosticAttempt
          ) {
            classroomSnapshot = {
              ...classroomSnapshot,
              revision: classroomSnapshot.revision + 1,
              reviewArtifacts: classroomSnapshot.reviewArtifacts.map(
                candidate => candidate.id === artifact.id
                  ? {
                      ...artifact,
                      diagnosticClaim: null,
                      updatedAt: currentNow,
                      updatedRevision: classroomSnapshot.revision + 1,
                    }
                  : candidate,
              ),
            }
          }
        }
      }
      else if (command.type === 'record_remediation_diagnostic_failure') {
        classroomSnapshot = {
          ...classroomSnapshot,
          revision: classroomSnapshot.revision + 1,
          reviewArtifacts: classroomSnapshot.reviewArtifacts.map((artifact) => {
            if (
              artifact.type !== 'remediation'
              || artifact.attemptIds[0] !== command.failedAttemptId
            ) {
              return artifact
            }
            return {
              ...artifact,
              diagnosticAttempts: command.diagnosticAttempt,
              diagnosticFailure: command.failure,
              diagnosticClaim: null,
              nextDiagnosticAttemptAt:
                command.failure === 'context_too_large'
                  ? null
                  : currentNow + 5_000,
              updatedAt: currentNow,
              updatedRevision: classroomSnapshot.revision + 1,
            }
          }),
        }
      }
      return structuredClone(classroomSnapshot)
    },
  )
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: {
      request: vi.fn(async (
        name: string,
        _options: LockOptions,
        callback: (lock: Lock | null) => Promise<unknown>,
      ) => callback({ name, mode: 'exclusive' })),
    },
  })
  classroomSnapshot = createEmptyClassroom()
  currentNow = 123
  catalogConceptIds = ['cj.program.main']
  classroomListeners.clear()
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState(), true)
  usePlaygroundSession.setState(usePlaygroundSession.getInitialState(), true)
})

afterEach(() => {
  cleanup()
})

describe('teacherChatRuntime', () => {
  it('replays a prepared prompt after the composer runtime is replaced', async () => {
    const prompt = 'Please start the first lesson.'
    useWorkspaceStore.getState().setPendingPrefill(prompt)
    const rendered = render(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="en" />
      </WorkspaceContext>,
    )

    await waitFor(() => {
      expect(mocks.composerRuntime.setText).toHaveBeenCalledWith(prompt)
    })
    expect(useWorkspaceStore.getState().pendingPrefill).toBe(prompt)

    const replacement = {
      getState: () => ({ text: '' }),
      setText: vi.fn<(text: string) => void>(),
      setRunConfig: vi.fn<(runConfig: Record<string, unknown>) => void>(),
      unstable_on: vi.fn((_event: string, listener: () => void) => {
        mocks.composerSendListeners.push(listener)
        return () => {
          const index = mocks.composerSendListeners.indexOf(listener)
          if (index >= 0)
            mocks.composerSendListeners.splice(index, 1)
        }
      }),
    }
    mocks.composerRuntime = replacement
    rendered.rerender(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="en" />
      </WorkspaceContext>,
    )
    await waitFor(() => expect(replacement.setText).toHaveBeenCalledWith(prompt))
  })

  it('attaches first-lesson intent to the submitted run metadata', async () => {
    const prompt = 'Please start the first lesson.'
    useWorkspaceStore.getState().setPendingPrefill(prompt, {
      type: 'first_lesson',
      learningTrackId: 'track:first',
    })
    render(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="en" />
      </WorkspaceContext>,
    )

    await waitFor(() => {
      expect(mocks.composerRuntime.setRunConfig).toHaveBeenCalledWith({
        custom: {
          teacherIntent: 'first_lesson',
          teacherLearningTrackId: 'track:first',
        },
      })
    })
    act(() => mocks.composerSendListeners.at(-1)?.())
    expect(mocks.composerRuntime.setRunConfig).toHaveBeenLastCalledWith({})
  })

  it('clears a recoverable composer draft after sending', async () => {
    useWorkspaceStore.getState().setCancelledDraft('Please try again.')
    render(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="en" />
      </WorkspaceContext>,
    )

    await waitFor(() => expect(mocks.composerSendListeners).toHaveLength(1))
    act(() => mocks.composerSendListeners[0]?.())

    expect(useWorkspaceStore.getState().cancelledDraft).toBeNull()
    expect(useWorkspaceStore.getState().pendingPrefill).toBeNull()
  })

  it('builds a Review-scoped, capability-limited Lesson Orchestrator', () => {
    useWorkspaceStore.getState().openReviewConcept('cj.program.main')
    render(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="en" />
      </WorkspaceContext>,
    )
    const deps = mocks.createToolkit.mock.calls[0]?.[0] as {
      getChatScope: () => unknown
      classroom: Record<string, unknown>
    }
    expect(deps.getChatScope()).toEqual({
      mode: 'review',
      conceptId: 'cj.program.main',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      learningTrackId: null,
    })
    expect(deps.classroom).toEqual(expect.objectContaining({
      read: expect.any(Function),
      commit: expect.any(Function),
    }))
    expect(deps.classroom).not.toHaveProperty('startLearningTrack')
    expect(mocks.createAgent).toHaveBeenCalled()
  })

  it('uses the visible Review fallback Concept for the Chat capability scope', () => {
    catalogConceptIds = ['cj.catalog.first', 'cj.track.first']
    classroomSnapshot = {
      ...createEmptyClassroom(),
      revision: 1,
      activeTrackId: 'track:active',
      tracks: [{
        id: 'track:active',
        goal: 'Review the active Track first.',
        conceptIds: ['cj.track.first'],
        contentVersions: { 'cj.track.first': 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
        adjustments: [],
        createdAt: 1,
        recordedRevision: 1,
      }],
    }
    useWorkspaceStore.getState().setView('review')

    render(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="en" />
      </WorkspaceContext>,
    )

    const deps = mocks.createToolkit.mock.calls[0]?.[0] as {
      getChatScope: () => unknown
    }
    expect(deps.getChatScope()).toEqual({
      mode: 'review',
      conceptId: 'cj.track.first',
      contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      learningTrackId: 'track:active',
    })
  })

  it('records the workspace Teacher Exposure Epoch before exposing chat text', async () => {
    classroomSnapshot = {
      ...createEmptyClassroom(),
      revision: 2,
      activeTrackId: 'track:active',
      tracks: [{
        id: 'track:active',
        goal: 'Learn main',
        conceptIds: ['cj.program.main'],
        contentVersions: { 'cj.program.main': 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
        adjustments: [],
        createdAt: 1,
        recordedRevision: 1,
      }],
      stream: [{
        id: 'exercise:open',
        type: 'exercise_instance',
        learningTrackId: 'track:active',
        tutoringStepId: 'step:1',
        conceptId: 'cj.program.main',
        learningSkillId: 'skill:run-main',
        packId: 'pack:main',
        contentVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        learningContractVersion: `lc:sha256:${'b'.repeat(64)}`,
        templateId: 'template:main',
        templateVersion: 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        purpose: 'practice',
        personalizationInputs: {
          unresolvedFailureEvidenceIds: [],
          remediationArtifactIds: [],
        },
        personalizationPolicyVersion: 2,
        effectiveDifficulty: 'standard',
        task: {
          type: 'code_output',
          prompt: 'Print hello',
          starterCode: 'main() {}',
          expectedOutput: 'hello',
          matchMode: 'exact',
          sourceRequirements: [{ type: 'top_level_main' }],
          hints: [],
        },
        createdAt: 2,
        recordedRevision: 2,
      }],
    }

    render(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="en" />
      </WorkspaceContext>,
    )
    const toolkitDeps = mocks.createToolkit.mock.calls[0]?.[0] as {
      getChatScope: () => unknown
    }
    expect(toolkitDeps.getChatScope()).toEqual({
      mode: 'live',
      learningTrackId: 'track:active',
    })
    const outputBoundary = mocks.createTransport.mock.calls[0]?.[2] as
      | { commit: (turnSignal: AbortSignal) => Promise<void> }
      | undefined
    expect(outputBoundary?.commit).toBeTypeOf('function')
    vi.mocked(context.classroom.execute).mockImplementationOnce(async () => {
      classroomSnapshot = {
        ...classroomSnapshot,
        revision: classroomSnapshot.revision + 1,
        teacherExposureEpoch: {
          id: 'exposure:teacher',
          interactionId: 'teacher:test',
          createdAt: 3,
          recordedRevision: classroomSnapshot.revision + 1,
        },
      }
      return classroomSnapshot
    })
    const turnController = new AbortController()
    await outputBoundary?.commit(turnController.signal)
    expect(context.classroom.execute).toHaveBeenCalledWith(
      {
        type: 'record_teacher_exposure',
        interactionId: expect.stringMatching(/^teacher:/),
      },
      {
        commitGuard: {
          assertActive: expect.any(Function),
        },
      },
    )
    const executionOptions = vi.mocked(
      context.classroom.execute,
    ).mock.calls[0]?.[1]
    expect(executionOptions?.commitGuard).toBeDefined()
    turnController.abort(new DOMException('learner stopped', 'AbortError'))
    expect(() => executionOptions?.commitGuard?.assertActive())
      .toThrow(/learner stopped/)
  })

  it('revokes a queued Teacher Exposure commit when the turn is aborted', async () => {
    classroomSnapshot = createEmptyClassroom()
    let releaseWrite!: () => void
    const writeBoundary = new Promise<void>((resolve) => {
      releaseWrite = resolve
    })
    vi.mocked(context.classroom.execute).mockImplementationOnce(async (
      command: ClassroomCommand,
      options?: AIClassroomExecutionOptions,
    ) => {
      await writeBoundary
      options?.commitGuard?.assertActive()
      if (command.type === 'record_teacher_exposure') {
        classroomSnapshot = {
          ...classroomSnapshot,
          revision: classroomSnapshot.revision + 1,
          teacherExposureEpoch: {
            id: 'exposure:late',
            interactionId: command.interactionId,
            createdAt: 3,
            recordedRevision: classroomSnapshot.revision + 1,
          },
        }
      }
      return classroomSnapshot
    })
    render(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="en" />
      </WorkspaceContext>,
    )
    const outputBoundary = mocks.createTransport.mock.calls[0]?.[2] as
      | { commit: (turnSignal: AbortSignal) => Promise<void> }
      | undefined
    const turnController = new AbortController()
    const pendingCommit = outputBoundary!.commit(turnController.signal)
    await waitFor(() => {
      expect(context.classroom.execute).toHaveBeenCalledOnce()
    })

    turnController.abort(new DOMException('learner stopped', 'AbortError'))
    releaseWrite()

    await expect(pendingCommit).rejects.toMatchObject({ name: 'AbortError' })
    expect(classroomSnapshot.teacherExposureEpoch).toBeNull()
  })

  it('keeps the active agent, transport, and turn budgets stable across unrelated classroom writes', () => {
    const rendered = render(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="en" />
      </WorkspaceContext>,
    )
    const toolkitBuilds = mocks.createToolkit.mock.calls.length
    const agentBuilds = mocks.createAgent.mock.calls.length
    const transportBuilds = mocks.createTransport.mock.calls.length
    const initialToolkitDeps = mocks.createToolkit.mock.calls[0]?.[0] as
      Record<string, unknown>

    classroomSnapshot = {
      ...classroomSnapshot,
      revision: classroomSnapshot.revision + 1,
    }
    rendered.rerender(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="en" />
      </WorkspaceContext>,
    )

    const rebuiltToolkitDeps = mocks.createToolkit.mock.calls[toolkitBuilds]?.[0] as
      Record<string, unknown> | undefined
    const changedDependencyKeys = rebuiltToolkitDeps
      ? Object.keys(initialToolkitDeps).filter(key =>
          initialToolkitDeps[key] !== rebuiltToolkitDeps[key])
      : []
    expect(changedDependencyKeys).toEqual([])
    expect(mocks.createToolkit).toHaveBeenCalledTimes(toolkitBuilds)
    expect(mocks.createAgent).toHaveBeenCalledTimes(agentBuilds)
    expect(mocks.createTransport).toHaveBeenCalledTimes(transportBuilds)
  })

  it('keeps one Live chat session across non-chat workspace views', async () => {
    render(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="en" />
      </WorkspaceContext>,
    )
    await waitFor(() => expect(mocks.createTransport).toHaveBeenCalledOnce())

    act(() => useWorkspaceStore.getState().setView('progress'))
    act(() => useWorkspaceStore.getState().setView('playground'))
    act(() => useWorkspaceStore.getState().setView('live'))

    expect(mocks.createTransport).toHaveBeenCalledOnce()
  })

  it('publishes the running Chat scope so navigation cannot dispose it silently', async () => {
    const rendered = render(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="en" />
      </WorkspaceContext>,
    )
    await waitFor(() => expect(mocks.createTransport).toHaveBeenCalledOnce())

    mocks.threadRunning = true
    rendered.rerender(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="en" />
      </WorkspaceContext>,
    )
    expect(useWorkspaceStore.getState().teacherChatRunMode).toBe('live')

    mocks.threadRunning = false
    rendered.rerender(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="en" />
      </WorkspaceContext>,
    )
    expect(useWorkspaceStore.getState().teacherChatRunMode).toBeNull()
  })

  it('restores a completed Live thread after visiting an isolated Review thread', async () => {
    const liveHistory: TeacherChatMessage[] = [{
      id: 'message:user',
      role: 'user',
      parts: [{ type: 'text', text: 'WAVE7_SCOPE_MARKER' }],
    }, {
      id: 'message:assistant',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Your lesson is ready.' }],
    }]
    render(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="en" />
      </WorkspaceContext>,
    )
    await waitFor(() => expect(mocks.chatRuntimeOptions.length).toBeGreaterThan(0))

    const liveOptions = mocks.chatRuntimeOptions.at(-1)
    act(() => liveOptions?.onFinish?.({ messages: liveHistory }))

    const beforeReview = mocks.chatRuntimeOptions.length
    act(() => useWorkspaceStore.getState().setView('review'))
    await waitFor(() => {
      expect(mocks.chatRuntimeOptions.length).toBeGreaterThan(beforeReview)
    })
    expect(mocks.chatRuntimeOptions.at(-1)?.messages).toBeUndefined()

    const beforeReturn = mocks.chatRuntimeOptions.length
    act(() => useWorkspaceStore.getState().setView('live'))
    await waitFor(() => {
      expect(mocks.chatRuntimeOptions.length).toBeGreaterThan(beforeReturn)
    })
    expect(mocks.chatRuntimeOptions.at(-1)?.messages).toEqual(liveHistory)
  })

  it('shows a safe scoped error when the teacher cannot complete a response', async () => {
    const rendered = render(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="zh" />
      </WorkspaceContext>,
    )
    await waitFor(() => expect(mocks.chatRuntimeOptions.length).toBeGreaterThan(0))

    act(() => {
      mocks.chatRuntimeOptions.at(-1)?.onError?.(
        new Error('429 upstream rejected sk-should-never-render'),
      )
      mocks.chatRuntimeOptions.at(-1)?.onFinish?.({
        isError: true,
        messages: [],
      })
    })
    const alert = rendered.getByTestId('teacher-runtime-error')
    expect(alert.getAttribute('role')).toBe('alert')
    expect(alert.textContent).toContain('AI 服务当前请求过多')
    expect(alert.textContent).not.toContain('sk-should-never-render')

    act(() => useWorkspaceStore.getState().setView('review'))
    await waitFor(() => {
      expect(rendered.queryByTestId('teacher-runtime-error')).toBeNull()
    })
    act(() => useWorkspaceStore.getState().setView('live'))
    expect(await rendered.findByTestId('teacher-runtime-error')).toBeTruthy()

    act(() => mocks.composerSendListeners.at(-1)?.())
    await waitFor(() => {
      expect(rendered.queryByTestId('teacher-runtime-error')).toBeNull()
    })
  })

  it('does not turn an intentional stop into an error banner', async () => {
    const rendered = render(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="en" />
      </WorkspaceContext>,
    )
    await waitFor(() => expect(mocks.chatRuntimeOptions.length).toBeGreaterThan(0))

    act(() => {
      mocks.chatRuntimeOptions.at(-1)?.onError?.(
        new DOMException('The learner stopped generation', 'AbortError'),
      )
    })
    expect(rendered.queryByTestId('teacher-runtime-error')).toBeNull()
  })

  it('clears a previous scoped error as soon as a retry starts', async () => {
    const rendered = render(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="en" />
      </WorkspaceContext>,
    )
    await waitFor(() => expect(mocks.chatRuntimeOptions.length).toBeGreaterThan(0))
    act(() => {
      mocks.chatRuntimeOptions.at(-1)?.onError?.(new Error('request failed'))
      mocks.chatRuntimeOptions.at(-1)?.onFinish?.({
        isError: true,
        messages: [],
      })
    })
    expect(rendered.getByTestId('teacher-runtime-error')).toBeTruthy()

    mocks.threadRunning = true
    rendered.rerender(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="en" />
      </WorkspaceContext>,
    )
    await waitFor(() => {
      expect(rendered.queryByTestId('teacher-runtime-error')).toBeNull()
    })
  })

  it('restores unsent composer drafts only in their original learning path', async () => {
    const makeTrack = (id: string) => ({
      id,
      goal: id,
      conceptIds: ['cj.program.main'],
      contentVersions: {
        'cj.program.main': 'cv:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
      adjustments: [],
      createdAt: 1,
      recordedRevision: 1,
    })
    classroomSnapshot = {
      ...createEmptyClassroom(),
      revision: 1,
      activeTrackId: 'track:first',
      tracks: [makeTrack('track:first'), makeTrack('track:second')],
    }
    const rendered = render(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="en" />
      </WorkspaceContext>,
    )
    await waitFor(() => expect(mocks.chatRuntimeOptions.length).toBeGreaterThan(0))

    mocks.composerRuntime.setText('draft for first')
    rendered.rerender(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="en" />
      </WorkspaceContext>,
    )

    const secondComposer = createComposerRuntime()
    mocks.composerRuntime = secondComposer
    act(() => {
      classroomSnapshot = {
        ...classroomSnapshot,
        revision: 2,
        activeTrackId: 'track:second',
      }
      notifyClassroom()
    })
    expect(secondComposer.setText).not.toHaveBeenCalledWith('draft for first')

    secondComposer.setText('draft for second')
    rendered.rerender(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="en" />
      </WorkspaceContext>,
    )

    const restoredFirstComposer = createComposerRuntime()
    mocks.composerRuntime = restoredFirstComposer
    act(() => {
      classroomSnapshot = {
        ...classroomSnapshot,
        revision: 3,
        activeTrackId: 'track:first',
      }
      notifyClassroom()
    })
    await waitFor(() => {
      expect(restoredFirstComposer.setText).toHaveBeenCalledWith('draft for first')
    })

    const restoredSecondComposer = createComposerRuntime()
    mocks.composerRuntime = restoredSecondComposer
    act(() => {
      classroomSnapshot = {
        ...classroomSnapshot,
        revision: 4,
        activeTrackId: 'track:second',
      }
      notifyClassroom()
    })
    await waitFor(() => {
      expect(restoredSecondComposer.setText).toHaveBeenCalledWith('draft for second')
    })
  })

  it('replaces one scoped session when the LLM configuration changes', async () => {
    const rendered = render(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="en" />
      </WorkspaceContext>,
    )
    await waitFor(() => expect(mocks.createTransport).toHaveBeenCalledOnce())
    const firstScopeSignal = mocks.createTransport.mock.calls[0]?.[1] as AbortSignal

    mocks.config = { model: 'replacement-model' }
    rendered.rerender(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="en" />
      </WorkspaceContext>,
    )

    await waitFor(() => expect(mocks.createTransport).toHaveBeenCalledTimes(2))
    expect(firstScopeSignal.aborted).toBe(true)
    const replacementScopeSignal = mocks.createTransport.mock.calls[1]?.[1] as AbortSignal
    expect(replacementScopeSignal.aborted).toBe(false)

    rendered.rerender(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="en" />
      </WorkspaceContext>,
    )
    expect(mocks.createTransport).toHaveBeenCalledTimes(2)
  })

  it('projects current Playground tab titles through the Teacher toolkit seam', () => {
    usePlaygroundSession.setState({
      tabs: [{
        id: 'tab:one',
        title: 'First draft',
        initialCode: 'main() {}',
        titleVersion: 'title:v1',
        contentVersion: 'content:v1',
        result: null,
        running: false,
      }],
    })
    render(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="en" />
      </WorkspaceContext>,
    )
    const deps = mocks.createToolkit.mock.calls[0]?.[0] as {
      playground: { listTabs: () => Array<{ id: string, title: string }> }
    }

    expect(deps.playground.listTabs()).toEqual([
      { id: 'tab:one', title: 'First draft' },
    ])

    usePlaygroundSession.setState(state => ({
      tabs: state.tabs.map(tab => ({ ...tab, title: 'Renamed draft' })),
    }))
    expect(deps.playground.listTabs()).toEqual([
      { id: 'tab:one', title: 'Renamed draft' },
    ])
  })

  it('runs a pending Remediation diagnostic outside visible chat history', async () => {
    classroomSnapshot = {
      ...createEmptyClassroom(),
      revision: 1,
      reviewArtifacts: [{
        id: 'remediation:pending',
        type: 'remediation',
        conceptId: 'cj.program.main',
        learningSkillId: 'skill:run-main',
        diagnosticStatus: 'pending',
        diagnosticAttempts: 0,
        diagnosticFailure: null,
        nextDiagnosticAttemptAt: null,
        diagnosticClaim: null,
        misconceptionTheme: null,
        markdown: null,
        attemptIds: ['attempt:failed'],
        evidenceIds: ['evidence:failed'],
        createdAt: 100,
        updatedAt: 100,
        createdRevision: 1,
        updatedRevision: 1,
      }],
    }

    render(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="en" />
      </WorkspaceContext>,
    )

    await waitFor(() => expect(mocks.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('attempt:failed'),
        abortSignal: expect.any(AbortSignal),
      }),
    ))
    const generationOptions = mocks.generate.mock.calls[0]?.[0] as {
      abortSignal: AbortSignal
      timeout?: number
    }
    expect(mocks.toolBudgetOpenSignals).toContain(
      generationOptions.abortSignal,
    )
    expect(generationOptions).not.toHaveProperty('timeout')
    expect(navigator.locks.request).toHaveBeenCalledWith(
      'playground-cj:remediation:attempt:failed',
      { mode: 'exclusive', ifAvailable: true },
      expect.any(Function),
    )
    const executedCommandCalls
      = vi.mocked(context.classroom.execute).mock.calls
    const executedCommands = executedCommandCalls.map(([command]) => command)
    const claimCommand = executedCommands.find(
      command => command.type === 'claim_remediation_diagnostic',
    )
    expect(claimCommand?.type).toBe('claim_remediation_diagnostic')
    if (claimCommand?.type !== 'claim_remediation_diagnostic')
      throw new Error('expected the automatic diagnostic claim command')
    expect(Number.isSafeInteger(claimCommand.observedAt)).toBe(true)
  })

  it('aborts the old tool loop when the Chat scope unmounts', () => {
    const rendered = render(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="en" />
      </WorkspaceContext>,
    )
    const scopeSignal = mocks.createTransport.mock.calls[0]?.[1] as AbortSignal
    expect(scopeSignal.aborted).toBe(false)
    rendered.unmount()
    expect(scopeSignal.aborted).toBe(true)
  })

  it('leaves a persisted diagnostic honestly pending when background generation fails', async () => {
    classroomSnapshot = {
      ...createEmptyClassroom(),
      revision: 1,
      reviewArtifacts: [{
        id: 'remediation:pending',
        type: 'remediation',
        conceptId: 'cj.program.main',
        learningSkillId: 'skill:run-main',
        diagnosticStatus: 'pending',
        diagnosticAttempts: 0,
        diagnosticFailure: null,
        nextDiagnosticAttemptAt: null,
        diagnosticClaim: null,
        misconceptionTheme: null,
        markdown: null,
        attemptIds: ['attempt:failed'],
        evidenceIds: ['evidence:failed'],
        createdAt: 100,
        updatedAt: 100,
        createdRevision: 1,
        updatedRevision: 1,
      }],
    }
    mocks.generate.mockRejectedValueOnce(new Error('model offline'))

    render(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="en" />
      </WorkspaceContext>,
    )

    await waitFor(() => expect(mocks.generate).toHaveBeenCalled())
    await waitFor(() => expect(context.classroom.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'record_remediation_diagnostic_failure',
        failedAttemptId: 'attempt:failed',
        diagnosticAttempt: 1,
        failure: 'generation_failed',
      }),
    ))
    expect(classroomSnapshot.reviewArtifacts[0]).toMatchObject({
      diagnosticStatus: 'pending',
      misconceptionTheme: null,
      markdown: null,
    })
  })

  it('backs off a diagnostic job held by another browser tab without claiming it', async () => {
    vi.useFakeTimers()
    classroomSnapshot = {
      ...createEmptyClassroom(),
      revision: 1,
      reviewArtifacts: [{
        id: 'remediation:pending',
        type: 'remediation',
        conceptId: 'cj.program.main',
        learningSkillId: 'skill:run-main',
        diagnosticStatus: 'pending',
        diagnosticAttempts: 0,
        diagnosticFailure: null,
        nextDiagnosticAttemptAt: null,
        diagnosticClaim: null,
        misconceptionTheme: null,
        markdown: null,
        attemptIds: ['attempt:failed'],
        evidenceIds: ['evidence:failed'],
        createdAt: 100,
        updatedAt: 100,
        createdRevision: 1,
        updatedRevision: 1,
      }],
    }
    vi.mocked(navigator.locks.request).mockImplementation(
      async (_name, _options, callback) => callback(null),
    )

    try {
      render(
        <WorkspaceContext value={context}>
          <TeacherChatRuntime lang="en" />
        </WorkspaceContext>,
      )
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(navigator.locks.request).toHaveBeenCalledTimes(1)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(499)
      })
      expect(navigator.locks.request).toHaveBeenCalledTimes(1)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1)
      })
      expect(navigator.locks.request).toHaveBeenCalledTimes(2)
      expect(context.classroom.execute).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'claim_remediation_diagnostic' }),
      )
      expect(mocks.generate).not.toHaveBeenCalled()
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('does not wake or replace an old persisted claim automatically', async () => {
    currentNow = 100_000
    classroomSnapshot = {
      ...createEmptyClassroom(),
      revision: 2,
      reviewArtifacts: [{
        id: 'remediation:old-claim',
        type: 'remediation',
        conceptId: 'cj.program.main',
        learningSkillId: 'skill:run-main',
        diagnosticStatus: 'pending',
        diagnosticAttempts: 0,
        diagnosticFailure: null,
        nextDiagnosticAttemptAt: null,
        diagnosticClaim: {
          job: {
            artifactId: 'remediation:old-claim',
            failedAttemptId: 'attempt:old-claim',
            diagnosticAttempt: 1,
          },
          ownerNonce: 'owner:possibly-still-running',
          claimedAt: 100,
          expiresAt: 45_100,
        },
        misconceptionTheme: null,
        markdown: null,
        attemptIds: ['attempt:old-claim'],
        evidenceIds: ['evidence:old-claim'],
        createdAt: 100,
        updatedAt: 100,
        createdRevision: 1,
        updatedRevision: 2,
      }],
    }

    render(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="en" />
      </WorkspaceContext>,
    )

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(navigator.locks.request).not.toHaveBeenCalled()
    expect(context.classroom.execute).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'claim_remediation_diagnostic' }),
    )
    expect(mocks.generate).not.toHaveBeenCalled()
  })

  it('persists a failed diagnostic attempt when the model exits without retaining content', async () => {
    classroomSnapshot = {
      ...createEmptyClassroom(),
      revision: 1,
      reviewArtifacts: [{
        id: 'remediation:pending',
        type: 'remediation',
        conceptId: 'cj.program.main',
        learningSkillId: 'skill:run-main',
        diagnosticStatus: 'pending',
        diagnosticAttempts: 0,
        diagnosticFailure: null,
        nextDiagnosticAttemptAt: null,
        diagnosticClaim: null,
        misconceptionTheme: null,
        markdown: null,
        attemptIds: ['attempt:failed'],
        evidenceIds: ['evidence:failed'],
        createdAt: 100,
        updatedAt: 100,
        createdRevision: 1,
        updatedRevision: 1,
      }],
    }

    render(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="en" />
      </WorkspaceContext>,
    )

    await waitFor(() => expect(context.classroom.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'record_remediation_diagnostic_failure',
        failedAttemptId: 'attempt:failed',
        diagnosticAttempt: 1,
        failure: 'retention_not_completed',
      }),
    ))
  })

  it('waits until the persisted diagnostic retry time instead of retrying on mount', async () => {
    vi.useFakeTimers()
    currentNow = 1_000
    classroomSnapshot = {
      ...createEmptyClassroom(),
      revision: 2,
      reviewArtifacts: [{
        id: 'remediation:pending',
        type: 'remediation',
        conceptId: 'cj.program.main',
        learningSkillId: 'skill:run-main',
        diagnosticStatus: 'pending',
        diagnosticAttempts: 1,
        diagnosticFailure: 'generation_failed',
        nextDiagnosticAttemptAt: 1_500,
        diagnosticClaim: null,
        misconceptionTheme: null,
        markdown: null,
        attemptIds: ['attempt:failed'],
        evidenceIds: ['evidence:failed'],
        createdAt: 100,
        updatedAt: 1_000,
        createdRevision: 1,
        updatedRevision: 2,
      }],
    }

    try {
      render(
        <WorkspaceContext value={context}>
          <TeacherChatRuntime lang="en" />
        </WorkspaceContext>,
      )
      await act(async () => undefined)
      expect(mocks.generate).not.toHaveBeenCalled()

      currentNow = 1_500
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500)
      })
      expect(mocks.generate).toHaveBeenCalled()
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('advances a persisted diagnostic retry across a wall-clock rollback', async () => {
    vi.useFakeTimers()
    currentNow = 1_000
    classroomSnapshot = {
      ...createEmptyClassroom(),
      revision: 2,
      reviewArtifacts: [{
        id: 'remediation:pending',
        type: 'remediation',
        conceptId: 'cj.program.main',
        learningSkillId: 'skill:run-main',
        diagnosticStatus: 'pending',
        diagnosticAttempts: 1,
        diagnosticFailure: 'generation_failed',
        nextDiagnosticAttemptAt: 10_500,
        diagnosticClaim: null,
        misconceptionTheme: null,
        markdown: null,
        attemptIds: ['attempt:failed'],
        evidenceIds: ['evidence:failed'],
        createdAt: 100,
        updatedAt: 10_000,
        createdRevision: 1,
        updatedRevision: 2,
      }],
    }

    try {
      render(
        <WorkspaceContext value={context}>
          <TeacherChatRuntime lang="en" />
        </WorkspaceContext>,
      )
      await act(async () => undefined)
      expect(mocks.generate).not.toHaveBeenCalled()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500)
      })
      expect(mocks.generate).toHaveBeenCalled()
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('does not invoke the model again after a diagnostic reaches its terminal failed state', async () => {
    classroomSnapshot = {
      ...createEmptyClassroom(),
      revision: 4,
      reviewArtifacts: [{
        id: 'remediation:failed',
        type: 'remediation',
        conceptId: 'cj.program.main',
        learningSkillId: 'skill:run-main',
        diagnosticStatus: 'failed',
        diagnosticAttempts: 3,
        diagnosticFailure: 'generation_failed',
        nextDiagnosticAttemptAt: null,
        diagnosticClaim: null,
        misconceptionTheme: null,
        markdown: null,
        attemptIds: ['attempt:failed'],
        evidenceIds: ['evidence:failed'],
        createdAt: 100,
        updatedAt: 1_000,
        createdRevision: 1,
        updatedRevision: 4,
      }],
    }

    render(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="en" />
      </WorkspaceContext>,
    )
    await act(async () => undefined)

    expect(mocks.generate).not.toHaveBeenCalled()
    expect(context.classroom.execute).not.toHaveBeenCalled()
  })

  it('runs the bounded diagnostic without Web Locks instead of abandoning it', async () => {
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: undefined,
    })
    classroomSnapshot = {
      ...createEmptyClassroom(),
      revision: 1,
      reviewArtifacts: [{
        id: 'remediation:pending',
        type: 'remediation',
        conceptId: 'cj.program.main',
        learningSkillId: 'skill:run-main',
        diagnosticStatus: 'pending',
        diagnosticAttempts: 0,
        diagnosticFailure: null,
        nextDiagnosticAttemptAt: null,
        diagnosticClaim: null,
        misconceptionTheme: null,
        markdown: null,
        attemptIds: ['attempt:failed'],
        evidenceIds: ['evidence:failed'],
        createdAt: 100,
        updatedAt: 100,
        createdRevision: 1,
        updatedRevision: 1,
      }],
    }

    render(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="en" />
      </WorkspaceContext>,
    )

    await waitFor(() => expect(mocks.generate).toHaveBeenCalled())
  })

  it('backs off infrastructure failures and opens a bounded local circuit', async () => {
    vi.useFakeTimers()
    classroomSnapshot = {
      ...createEmptyClassroom(),
      revision: 1,
      reviewArtifacts: [{
        id: 'remediation:storage-offline',
        type: 'remediation',
        conceptId: 'cj.program.main',
        learningSkillId: 'skill:run-main',
        diagnosticStatus: 'pending',
        diagnosticAttempts: 0,
        diagnosticFailure: null,
        nextDiagnosticAttemptAt: null,
        diagnosticClaim: null,
        misconceptionTheme: null,
        markdown: null,
        attemptIds: ['attempt:storage-offline'],
        evidenceIds: ['evidence:storage-offline'],
        createdAt: 100,
        updatedAt: 100,
        createdRevision: 1,
        updatedRevision: 1,
      }],
    }
    vi.mocked(context.classroom.execute).mockRejectedValue(
      new Error('IndexedDB unavailable'),
    )
    const claimAttempts = () => {
      const calls = vi.mocked(context.classroom.execute).mock.calls
      return calls.filter(
        ([command]) => command.type === 'claim_remediation_diagnostic',
      ).length
    }

    try {
      render(
        <WorkspaceContext value={context}>
          <TeacherChatRuntime lang="en" />
        </WorkspaceContext>,
      )
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(claimAttempts()).toBe(1)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(499)
      })
      expect(claimAttempts()).toBe(1)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1)
      })
      expect(claimAttempts()).toBe(2)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(999)
      })
      expect(claimAttempts()).toBe(2)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1)
      })
      expect(claimAttempts()).toBe(3)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_999)
      })
      expect(claimAttempts()).toBe(3)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1)
      })
      expect(claimAttempts()).toBe(4)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3_999)
      })
      expect(claimAttempts()).toBe(4)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1)
      })
      expect(claimAttempts()).toBe(5)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000)
      })
      expect(claimAttempts()).toBe(5)
      expect(mocks.generate).not.toHaveBeenCalled()
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('parks a no-lock effect restart before its durable claim until the active provider settles', async () => {
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: undefined,
    })
    let releaseGeneration!: () => void
    const generationBlocked = new Promise<void>((resolve) => {
      releaseGeneration = resolve
    })
    mocks.generate.mockImplementationOnce(() => generationBlocked)
    const firstArtifact = {
      id: 'remediation:first',
      type: 'remediation' as const,
      conceptId: 'cj.program.main',
      learningSkillId: 'skill:run-main',
      diagnosticStatus: 'pending' as const,
      diagnosticAttempts: 0,
      diagnosticFailure: null,
      nextDiagnosticAttemptAt: null,
      diagnosticClaim: null,
      misconceptionTheme: null,
      markdown: null,
      attemptIds: ['attempt:first'],
      evidenceIds: ['evidence:first'],
      createdAt: 100,
      updatedAt: 100,
      createdRevision: 1,
      updatedRevision: 1,
    }
    classroomSnapshot = {
      ...createEmptyClassroom(),
      revision: 1,
      reviewArtifacts: [firstArtifact],
    }
    const rendered = render(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="en" />
      </WorkspaceContext>,
    )
    await waitFor(() => expect(mocks.generate).toHaveBeenCalledTimes(1))
    const claimedFirstArtifact = classroomSnapshot.reviewArtifacts[0]!
    vi.mocked(context.classroom.execute).mockClear()

    classroomSnapshot = {
      ...classroomSnapshot,
      revision: classroomSnapshot.revision + 1,
      reviewArtifacts: [
        claimedFirstArtifact,
        {
          ...firstArtifact,
          id: 'remediation:second',
          attemptIds: ['attempt:second'],
          evidenceIds: ['evidence:second'],
          updatedAt: 101,
          createdRevision: 2,
          updatedRevision: 2,
        },
      ],
    }
    notifyClassroom()
    rendered.rerender(
      <WorkspaceContext value={context}>
        <TeacherChatRuntime lang="en" />
      </WorkspaceContext>,
    )
    await act(async () => undefined)

    expect(context.classroom.execute).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'claim_remediation_diagnostic',
        job: expect.objectContaining({
          failedAttemptId: 'attempt:second',
        }),
      }),
    )

    releaseGeneration()
    await act(async () => {
      await generationBlocked
    })
    await waitFor(() => expect(context.classroom.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'claim_remediation_diagnostic',
        job: expect.objectContaining({
          failedAttemptId: 'attempt:second',
        }),
      }),
    ))
    await waitFor(() => expect(mocks.generate).toHaveBeenCalledTimes(2))
    rendered.unmount()
  })

  it('keeps a timed-out diagnostic job single-flight until the provider settles', async () => {
    const timeoutController = new AbortController()
    const nextTimeoutController = new AbortController()
    const timeout = vi.spyOn(AbortSignal, 'timeout')
      .mockReturnValueOnce(timeoutController.signal)
      .mockReturnValue(nextTimeoutController.signal)
    try {
      Object.defineProperty(navigator, 'locks', {
        configurable: true,
        value: undefined,
      })
      const firstArtifact = {
        id: 'remediation:never-settles',
        type: 'remediation' as const,
        conceptId: 'cj.program.main',
        learningSkillId: 'skill:run-main',
        diagnosticStatus: 'pending' as const,
        diagnosticAttempts: 0,
        diagnosticFailure: null,
        nextDiagnosticAttemptAt: null,
        diagnosticClaim: null,
        misconceptionTheme: null,
        markdown: null,
        attemptIds: ['attempt:never-settles'],
        evidenceIds: ['evidence:never-settles'],
        createdAt: 100,
        updatedAt: 100,
        createdRevision: 1,
        updatedRevision: 1,
      }
      let settleProvider!: () => void
      const providerOperation = new Promise<void>((resolve) => {
        settleProvider = resolve
      })
      mocks.generate.mockImplementationOnce(() => providerOperation)
      classroomSnapshot = {
        ...createEmptyClassroom(),
        revision: 1,
        reviewArtifacts: [firstArtifact],
      }
      const rendered = render(
        <WorkspaceContext value={context}>
          <TeacherChatRuntime lang="en" />
        </WorkspaceContext>,
      )
      await act(async () => {
        await Promise.resolve()
      })
      expect(mocks.generate).toHaveBeenCalledTimes(1)

      expect(timeout).toHaveBeenCalledWith(30_000)
      await act(async () => {
        timeoutController.abort(
          new DOMException('Diagnostic timed out.', 'TimeoutError'),
        )
        await Promise.resolve()
      })
      expect(context.classroom.execute).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'record_remediation_diagnostic_failure',
          failedAttemptId: 'attempt:never-settles',
        }),
      )

      classroomSnapshot = {
        ...createEmptyClassroom(),
        revision: classroomSnapshot.revision + 1,
        reviewArtifacts: [{
          ...firstArtifact,
          id: 'remediation:next',
          attemptIds: ['attempt:next'],
          evidenceIds: ['evidence:next'],
          createdRevision: 2,
          updatedRevision: 2,
        }],
      }
      notifyClassroom()
      rendered.rerender(
        <WorkspaceContext value={context}>
          <TeacherChatRuntime lang="en" />
        </WorkspaceContext>,
      )
      await act(async () => {
        await Promise.resolve()
      })
      expect(mocks.generate).toHaveBeenCalledTimes(1)

      settleProvider()
      await act(async () => {
        await providerOperation
      })
      expect(context.classroom.execute).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'record_remediation_diagnostic_failure',
          failedAttemptId: 'attempt:never-settles',
        }),
      )
      classroomSnapshot = {
        ...classroomSnapshot,
        revision: classroomSnapshot.revision + 1,
        reviewArtifacts: [...classroomSnapshot.reviewArtifacts],
      }
      notifyClassroom()
      rendered.rerender(
        <WorkspaceContext value={context}>
          <TeacherChatRuntime lang="en" />
        </WorkspaceContext>,
      )
      await waitFor(() => expect(mocks.generate).toHaveBeenCalledTimes(2))
    }
    finally {
      timeout.mockRestore()
    }
  })
})
