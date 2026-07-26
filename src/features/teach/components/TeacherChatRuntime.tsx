'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AssistantRuntimeProvider, useAuiState, useComposerRuntime } from '@assistant-ui/react'
import { useChatRuntime } from '@assistant-ui/react-ai-sdk'
import type { InferAgentUIMessage } from 'ai'
import { useActorRef } from '@xstate/react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Thread } from '@/modules/assistant-ui/chat/Thread'
import {
  createLessonOrchestratorClassroom,
  createRemediationToolkit,
  createTeacherMutationBudget,
  createTeacherToolCallBudget,
  createTeacherToolkit,
} from '@/lib/teach/teacher/toolkit'
import type { TeacherChatScope } from '@/lib/teach/teacher/toolkit'
import {
  createRemediationAgent,
  createTeacherAgent,
} from '@/lib/teach/teacher/agent'
import type { TeacherAgent } from '@/lib/teach/teacher/agent'
import type { TeacherLang } from '@/lib/teach/teacher/system-prompt'
import { createScopedChatTransport } from '@/lib/teach/teacher/scoped-chat-transport'
import { useLLMConfig, useLLMConfigStore } from '@/stores/llmConfig'
import { useLLMConfigBootstrap } from '@/modules/llm-config/runtime/useLLMConfigBootstrap'
import { probeExhaustedQuota } from '@/modules/llm-config/runtime/auto-quota'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import { useAbortScope } from '@/features/teach/context/abort-scope'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import { resolveReviewConceptId } from '@/features/teach/state/resolve-review-concept'
import { useClassroomSnapshot } from '@/features/teach/hooks/use-classroom-snapshot'
import type { AIClassroom } from '@/lib/teach/classroom/ai-classroom'
import type {
  RemediationDiagnosticClaimAuthority,
} from '@/lib/teach/classroom/state'
import { awaitWithSignal } from '@/lib/ai/abortable-operation'
import {
  RemediationJobBusyError,
  RemediationJobCancelledError,
} from './automatic-remediation-job'
import {
  createAutomaticRemediationCoordinatorMachine,
  selectPendingRemediationJobs,
} from '../state/automatic-remediation-coordinator'

type TeacherChatMessage = InferAgentUIMessage<TeacherAgent>

function normalizeLang(lang: string): TeacherLang {
  return lang === 'en' ? 'en' : 'zh'
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

/**
 * Chat histories are scoped by surface and active Learning Track. Switching
 * Tracks, entering Review View, or selecting another Review Concept mounts a
 * fresh temporary thread instead of leaking context across learning paths.
 */
export function TeacherChatRuntime({ lang }: { lang: string }) {
  useLLMConfigBootstrap({ reportErrors: false })
  const { catalog, classroom } = useWorkspace()
  const snapshot = useClassroomSnapshot(classroom)
  const view = useWorkspaceStore(state => state.view)
  const reviewConceptId = useWorkspaceStore(state => state.reviewConceptId)
  const requestedReviewContentVersion = useWorkspaceStore(
    state => state.reviewContentVersion,
  )
  const resolvedReviewConceptId = resolveReviewConceptId(
    reviewConceptId,
    snapshot,
    catalog,
  )
  const currentReviewContentVersion = resolvedReviewConceptId
    ? catalog.get(resolvedReviewConceptId)?.version ?? null
    : null
  const displayedReviewContentVersion = resolvedReviewConceptId
    && requestedReviewContentVersion
    && catalog.getVersion(
      resolvedReviewConceptId,
      requestedReviewContentVersion,
    )
    ? requestedReviewContentVersion
    : currentReviewContentVersion
  const activeTrackId = snapshot.activeTrackId
  const scope = useMemo<TeacherChatScope>(
    () => view === 'review'
      && resolvedReviewConceptId
      && displayedReviewContentVersion
      ? {
          mode: 'review',
          conceptId: resolvedReviewConceptId,
          contentVersion: displayedReviewContentVersion,
          learningTrackId: activeTrackId,
        }
      : { mode: 'live', learningTrackId: activeTrackId },
    [
      activeTrackId,
      displayedReviewContentVersion,
      resolvedReviewConceptId,
      view,
    ],
  )
  const scopeKey = scope.mode === 'live'
    ? `live:${scope.learningTrackId ?? 'no-track'}`
    : `review:${scope.conceptId}:${scope.contentVersion}:`
      + `${scope.learningTrackId ?? 'no-track'}`
  const [remediationGenerationGate] = useState(
    createLocalRemediationGenerationGate,
  )
  return (
    <ScopedTeacherChat
      key={scopeKey}
      lang={normalizeLang(lang)}
      remediationGenerationGate={remediationGenerationGate}
      scope={scope}
    />
  )
}

function ScopedTeacherChat({
  lang,
  remediationGenerationGate,
  scope,
}: {
  lang: TeacherLang
  remediationGenerationGate: LocalRemediationGenerationGate
  scope: TeacherChatScope
}) {
  const config = useLLMConfig()
  const {
    activeEditor,
    catalog,
    classroom,
    knowledge,
    now,
  } = useWorkspace()
  const workspaceSignal = useAbortScope()
  const [localScopeController] = useState(() => new AbortController())
  const scopeSignal = useMemo(
    () => AbortSignal.any([workspaceSignal, localScopeController.signal]),
    [localScopeController, workspaceSignal],
  )

  useEffect(() => {
    return () => localScopeController.abort(
      new DOMException('Teacher Chat scope changed', 'AbortError'),
    )
  }, [localScopeController])
  const playground = useMemo(() => ({
    listTabs: () => useWorkspaceStore.getState().playgroundTabs.map(
      ({ id, title }) => ({ id, title }),
    ),
  }), [])

  const orchestratorClassroom = useMemo(
    () => createLessonOrchestratorClassroom(classroom),
    [classroom],
  )
  const getChatScope = useMemo(() => () => scope, [scope])
  const createTeacherInteractionId = useMemo(() => () => {
    if (typeof globalThis.crypto?.randomUUID !== 'function') {
      throw new TypeError(
        'crypto.randomUUID() is required to record the Teacher Exposure Epoch',
      )
    }
    return `teacher:${globalThis.crypto.randomUUID()}`
  }, [])
  const getAssignedRemediationClaim = useCallback(
    () => remediationGenerationGate.currentClaim,
    [remediationGenerationGate],
  )
  const getAssignedFailedAttemptId = useCallback(
    () => getAssignedRemediationClaim()?.job.failedAttemptId ?? null,
    [getAssignedRemediationClaim],
  )
  const teacherOutputBoundary = useMemo(() => {
    return {
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
  }, [classroom, createTeacherInteractionId])
  const {
    remediationAgent,
    remediationMutationBudget,
    remediationToolCallBudget,
    transport,
  } = useMemo(() => {
    const teacherMutationBudget = createTeacherMutationBudget(0)
    const teacherToolCallBudget = createTeacherToolCallBudget()
    const toolkit = createTeacherToolkit({
      classroom: orchestratorClassroom,
      catalog,
      knowledge,
      editor: activeEditor,
      playground,
      mutationBudget: teacherMutationBudget,
      toolCallBudget: teacherToolCallBudget,
      lang,
      getChatScope,
      createTeacherInteractionId,
    })
    const agent = createTeacherAgent(config, toolkit, lang)
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
    return {
      remediationAgent,
      remediationMutationBudget,
      remediationToolCallBudget,
      transport: createScopedChatTransport(
        agent,
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
      ),
    }
  }, [
    activeEditor,
    catalog,
    config,
    createTeacherInteractionId,
    getAssignedFailedAttemptId,
    getAssignedRemediationClaim,
    getChatScope,
    knowledge,
    lang,
    orchestratorClassroom,
    playground,
    scopeSignal,
    teacherOutputBoundary,
  ])
  const runtime = useChatRuntime<TeacherChatMessage>({ transport })
  const generateRemediation = useMemo(() => async (
    failedAttemptId: string,
    diagnosticClaim: RemediationDiagnosticClaimAuthority,
    abortSignal: AbortSignal,
  ) => {
    const releaseAssignment = remediationGenerationGate.acquire(diagnosticClaim)
    // Compose our own timeout signal and pass that exact signal to the agent.
    // AI SDK would otherwise merge its `timeout` option into a different
    // AbortSignal, breaking the per-turn tool-call lease identity.
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
    let released = false
    const releaseJob = () => {
      if (released)
        return
      released = true
      try {
        toolCallLease.close()
      }
      finally {
        releaseAssignment()
      }
    }
    let providerOperation: ReturnType<typeof remediationAgent.generate>
    try {
      operationSignal.throwIfAborted()
      providerOperation = remediationAgent.generate({
        prompt: lang === 'en'
          ? `Diagnose only the assigned failed Attempt ${failedAttemptId}.`
          : `只诊断指定的失败 Attempt ${failedAttemptId}。`,
        abortSignal: operationSignal,
      })
    }
    catch (error) {
      releaseJob()
      throw error
    }
    const ownedProviderOperation = Promise.resolve(providerOperation).then(
      (value) => {
        releaseJob()
        return value
      },
      (error) => {
        releaseJob()
        throw error
      },
    )
    // Keep both the local and durable job ownership until the raw provider
    // operation settles. A provider that ignores abort cannot be allowed to
    // overlap a replacement model call merely because the deadline fired.
    await ownedProviderOperation
    if (operationSignal.aborted)
      throw new RemediationJobCancelledError()
    return classroom.snapshot().reviewArtifacts.some(artifact =>
      artifact.type === 'remediation'
      && artifact.attemptIds.includes(failedAttemptId)
      && artifact.diagnosticStatus === 'ready')
  }, [
    classroom,
    lang,
    remediationAgent,
    remediationMutationBudget,
    remediationToolCallBudget,
    remediationGenerationGate,
  ])

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ComposerPrefillBridge />
      <AutoQuotaWatcher />
      <AutomaticRemediationCoordinator
        classroom={classroom}
        generate={generateRemediation}
        now={now}
        waitForLocalIdle={remediationGenerationGate.waitUntilIdle}
      />
      <TooltipProvider delayDuration={250}>
        <Thread allowAttachments={false} />
      </TooltipProvider>
    </AssistantRuntimeProvider>
  )
}

function AutomaticRemediationCoordinator({
  classroom,
  generate,
  now,
  waitForLocalIdle,
}: {
  classroom: AIClassroom
  generate: (
    failedAttemptId: string,
    diagnosticClaim: RemediationDiagnosticClaimAuthority,
    abortSignal: AbortSignal,
  ) => Promise<boolean>
  now: () => number
  waitForLocalIdle: (signal: AbortSignal) => Promise<void>
}) {
  const snapshot = useClassroomSnapshot(classroom)
  const pendingJobs = useMemo(
    () => selectPendingRemediationJobs(snapshot.reviewArtifacts),
    [snapshot.reviewArtifacts],
  )
  const pendingJobScheduleKey = pendingJobs.map(job =>
    `${job.artifactId}\u0000${job.failedAttemptId}`
    + `\u0000${job.diagnosticAttempt}`
    + `\u0000${job.nextDiagnosticAttemptAt ?? 'now'}`
    + `\u0000${job.diagnosticClaim?.ownerNonce ?? 'unclaimed'}`
    + `\u0000${job.updatedAt}`,
  ).join('\u0001')
  const machine = useMemo(
    () => createAutomaticRemediationCoordinatorMachine({
      classroom,
      generate,
      now,
      waitForLocalIdle,
    }),
    [classroom, generate, now, waitForLocalIdle],
  )
  const coordinator = useActorRef(machine)

  useEffect(() => {
    coordinator.send({
      type: 'jobs.changed',
      jobs: selectPendingRemediationJobs(
        classroom.snapshot().reviewArtifacts,
      ),
    })
  }, [classroom, coordinator, pendingJobScheduleKey])

  return null
}

/** Refresh server-side shared quota metadata after each completed turn. */
function AutoQuotaWatcher() {
  const running = useAuiState(state => state.thread.isRunning)
  const wasRunningRef = useRef(false)
  const keySource = useLLMConfigStore(state => state.keySource)
  const exhausted = useLLMConfigStore(state => state.autoQuota?.exhausted)
  const setAutoQuota = useLLMConfigStore(state => state.setAutoQuota)

  useEffect(() => {
    const finished = wasRunningRef.current && !running
    wasRunningRef.current = running
    if (!finished || keySource !== 'auto' || exhausted)
      return
    let active = true
    void probeExhaustedQuota().then((next) => {
      if (active && next)
        setAutoQuota(next)
    }).catch(() => undefined)
    return () => {
      active = false
    }
  }, [exhausted, keySource, running, setAutoQuota])

  return null
}

function ComposerPrefillBridge() {
  const composer = useComposerRuntime()
  const pendingPrefill = useWorkspaceStore(state => state.pendingPrefill)
  const consumePrefill = useWorkspaceStore(state => state.consumePrefill)

  useEffect(() => {
    if (pendingPrefill === null)
      return
    const prompt = consumePrefill()
    if (prompt !== null)
      composer.setText(prompt)
  }, [composer, consumePrefill, pendingPrefill])

  return null
}
