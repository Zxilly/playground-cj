import type { ChatTransport, InferAgentUIMessage } from 'ai'
import type { LLMConfig } from '@/lib/ai/model-provider'
import type { AIClassroom } from '@/lib/teach/classroom/ai-classroom'
import type { ContentPackCatalog } from '@/lib/teach/classroom/content-catalog'
import type { RemediationDiagnosticClaimAuthority } from '@/lib/teach/classroom/state'
import type { KnowledgeSource } from '@/lib/teach/knowledge/source'
import type { TeacherAgent } from '@/lib/teach/teacher/agent'
import type { TeacherLang } from '@/lib/teach/teacher/system-prompt'
import type { TeacherChatScope } from '@/lib/teach/teacher/toolkit'
import type { ActiveEditorRegistry } from './active-editor-store'
import { awaitWithSignal } from '@/lib/ai/abortable-operation'
import { createSettleAwareOperationOwnership } from '@/lib/ai/settle-aware-operation-ownership'
import {
  createRemediationAgent,
  createTeacherAgent,
} from '@/lib/teach/teacher/agent'
import { createScopedChatTransport } from '@/lib/teach/teacher/scoped-chat-transport'
import {
  createLessonOrchestratorClassroom,
  createRemediationToolkit,
  createTeacherMutationBudget,
  createTeacherToolCallBudget,
  createTeacherToolkit,
} from '@/lib/teach/teacher/toolkit'
import {
  RemediationJobBusyError,
  RemediationJobCancelledError,
} from './automatic-remediation-job'
import { startAutomaticRemediationCoordinator } from './automatic-remediation-coordinator'

export type TeacherChatMessage = InferAgentUIMessage<TeacherAgent>

export interface TeacherSessionDependencies {
  activeEditor: ActiveEditorRegistry
  catalog: ContentPackCatalog
  classroom: AIClassroom
  config: Partial<LLMConfig>
  knowledge: KnowledgeSource
  lang: TeacherLang
  listPlaygroundTabs: () => Array<{ id: string, title: string }>
  now: () => number
  scope: TeacherChatScope
  workspaceSignal: AbortSignal
}

export interface TeacherSession {
  transport: ChatTransport<TeacherChatMessage>
  dispose: () => void
}

export interface TeacherSessionRuntime {
  open: (dependencies: TeacherSessionDependencies) => TeacherSession
}

interface LocalRemediationGenerationGate {
  readonly currentClaim: RemediationDiagnosticClaimAuthority | null
  acquire: (claim: RemediationDiagnosticClaimAuthority) => () => void
  waitUntilIdle: (signal: AbortSignal) => Promise<void>
}

function createLocalRemediationGenerationGate(): LocalRemediationGenerationGate {
  let currentClaim: RemediationDiagnosticClaimAuthority | null = null
  let idle: Promise<void> = Promise.resolve()
  return {
    get currentClaim() {
      return currentClaim
    },
    acquire: (claim) => {
      if (currentClaim !== null)
        throw new RemediationJobBusyError()
      currentClaim = claim
      let announceIdle!: () => void
      idle = new Promise<void>((resolve) => {
        announceIdle = resolve
      })
      let released = false
      return () => {
        if (released)
          return
        released = true
        if (currentClaim === claim) {
          currentClaim = null
          announceIdle()
        }
      }
    },
    waitUntilIdle: signal => awaitWithSignal(idle, signal),
  }
}

function createTeacherInteractionId(): string {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new TypeError(
      'crypto.randomUUID() is required to record the Teacher Exposure Epoch',
    )
  }
  return `teacher:${globalThis.crypto.randomUUID()}`
}

/**
 * Own all non-visual work for one scoped Teacher Chat session. The runtime
 * keeps Remediation generation single-flight across scope replacement, while
 * each opened session owns its transport, budgets, aggregate subscription,
 * coordinator actor, and cancellation lifetime.
 */
export function createTeacherSessionRuntime(): TeacherSessionRuntime {
  const remediationGenerationGate = createLocalRemediationGenerationGate()

  return {
    open: (dependencies) => {
      const {
        activeEditor,
        catalog,
        classroom,
        config,
        knowledge,
        lang,
        listPlaygroundTabs,
        now,
        scope,
        workspaceSignal,
      } = dependencies
      const localScopeController = new AbortController()
      const scopeSignal = AbortSignal.any([
        workspaceSignal,
        localScopeController.signal,
      ])
      const orchestratorClassroom = createLessonOrchestratorClassroom(classroom)
      const getChatScope = () => scope
      const getAssignedRemediationClaim = () =>
        remediationGenerationGate.currentClaim
      const getAssignedFailedAttemptId = () =>
        getAssignedRemediationClaim()?.job.failedAttemptId ?? null
      const teacherMutationBudget = createTeacherMutationBudget(0)
      const teacherToolCallBudget = createTeacherToolCallBudget()
      const toolkit = createTeacherToolkit({
        classroom: orchestratorClassroom,
        catalog,
        knowledge,
        editor: activeEditor,
        playground: { listTabs: listPlaygroundTabs },
        mutationBudget: teacherMutationBudget,
        toolCallBudget: teacherToolCallBudget,
        lang,
        getChatScope,
        createTeacherInteractionId,
      })
      const teacherAgent = createTeacherAgent(config, toolkit, lang)
      const remediationMutationBudget = createTeacherMutationBudget(0)
      const remediationToolCallBudget = createTeacherToolCallBudget()
      const remediationToolkit = createRemediationToolkit({
        classroom: orchestratorClassroom,
        mutationBudget: remediationMutationBudget,
        toolCallBudget: remediationToolCallBudget,
        getAssignedFailedAttemptId,
        getAssignedRemediationClaim,
      })
      const remediationAgent = createRemediationAgent(
        config,
        remediationToolkit,
        lang,
      )
      const teacherOutputBoundary = {
        commit: async (turnSignal: AbortSignal) => {
          turnSignal.throwIfAborted()
          const committed = await classroom.execute(
            {
              type: 'record_teacher_exposure',
              interactionId: createTeacherInteractionId(),
            },
            {
              commitGuard: {
                assertActive: () => turnSignal.throwIfAborted(),
              },
            },
          )
          if (!committed.teacherExposureEpoch) {
            throw new Error(
              'Teacher Exposure Epoch was not persisted before output release',
            )
          }
        },
      }
      const transport = createScopedChatTransport(
        teacherAgent,
        scopeSignal,
        teacherOutputBoundary,
        (turnSignal) => {
          const lease = teacherToolCallBudget.open(turnSignal, {
            total: 16,
            documentationSearches: 3,
          })
          teacherMutationBudget.reset(6)
          return lease.close
        },
      )
      const generateRemediation = async (
        failedAttemptId: string,
        diagnosticClaim: RemediationDiagnosticClaimAuthority,
        abortSignal: AbortSignal,
      ) => {
        const releaseAssignment = remediationGenerationGate
          .acquire(diagnosticClaim)
        // Pass this exact bounded signal to the Agent so its tool-call lease
        // cannot outlive the Remediation generation that owns it.
        const operationSignal = AbortSignal.any([
          abortSignal,
          AbortSignal.timeout(30_000),
        ])
        let toolCallLease: ReturnType<typeof remediationToolCallBudget.open>
        try {
          toolCallLease = remediationToolCallBudget.open(operationSignal, {
            total: 3,
            documentationSearches: 0,
          })
          remediationMutationBudget.reset(1)
        }
        catch (error) {
          releaseAssignment()
          throw error
        }
        const providerOwnership = createSettleAwareOperationOwnership(() => {
          try {
            toolCallLease.close()
          }
          finally {
            releaseAssignment()
          }
        })
        try {
          operationSignal.throwIfAborted()
          await providerOwnership.own(
            remediationAgent.generate({
              prompt: lang === 'en'
                ? `Diagnose only the assigned failed Attempt ${failedAttemptId}.`
                : `只诊断指定的失败 Attempt ${failedAttemptId}。`,
              abortSignal: operationSignal,
            }),
          )
        }
        finally {
          await providerOwnership.finish()
        }
        if (operationSignal.aborted)
          throw new RemediationJobCancelledError()
        return classroom.snapshot().reviewArtifacts.some(artifact =>
          artifact.type === 'remediation'
          && artifact.attemptIds.includes(failedAttemptId)
          && artifact.diagnosticStatus === 'ready')
      }
      const remediationCoordinator = startAutomaticRemediationCoordinator({
        classroom,
        generate: generateRemediation,
        now,
        waitForLocalIdle: remediationGenerationGate.waitUntilIdle,
      })
      let disposed = false
      const dispose = () => {
        if (disposed)
          return
        disposed = true
        workspaceSignal.removeEventListener('abort', dispose)
        localScopeController.abort(
          new DOMException('Teacher Chat scope changed', 'AbortError'),
        )
        remediationCoordinator.dispose()
      }
      workspaceSignal.addEventListener('abort', dispose, { once: true })
      if (workspaceSignal.aborted)
        dispose()

      return { transport, dispose }
    },
  }
}
