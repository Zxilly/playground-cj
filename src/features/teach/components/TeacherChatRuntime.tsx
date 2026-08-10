'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AssistantRuntimeProvider, useAuiState, useComposerRuntime } from '@assistant-ui/react'
import { useChatRuntime } from '@assistant-ui/react-ai-sdk'
import { CircleAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Thread } from '@/modules/assistant-ui/chat/Thread'
import type { TeacherChatScope } from '@/lib/teach/teacher/toolkit'
import type { TeacherLang } from '@/lib/teach/teacher/system-prompt'
import { useLLMConfig, useLLMConfigStore } from '@/stores/llmConfig'
import { useLLMConfigBootstrap } from '@/modules/llm-config/runtime/useLLMConfigBootstrap'
import { probeExhaustedQuota } from '@/modules/llm-config/runtime/auto-quota'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import { useAbortScope } from '@/features/teach/context/abort-scope'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import type { TeacherChatRunMode } from '@/features/teach/state/workspace-store'
import { usePlaygroundSession } from '@/features/teach/state/playground-session'
import { resolveReviewConceptId } from '@/features/teach/state/resolve-review-concept'
import { useClassroomSnapshot } from '@/features/teach/hooks/use-classroom-snapshot'
import type {
  TeacherChatMessage,
  TeacherSession,
  TeacherSessionDependencies,
  TeacherSessionRuntime,
} from '../state/teacher-session'
import { createTeacherSessionRuntime } from '../state/teacher-session'

function normalizeLang(lang: string): TeacherLang {
  return lang === 'en' ? 'en' : 'zh'
}

const MAX_CACHED_CHAT_SCOPES = 12

function safeTeacherRuntimeError(error: unknown, lang: TeacherLang): string | null {
  const serialized = String(
    error instanceof Error ? `${error.name} ${error.message}` : error ?? '',
  ).toLowerCase()
  if (/abort|cancel|user aborted/.test(serialized))
    return null
  if (/429|rate.?limit|quota|too many requests/.test(serialized)) {
    return lang === 'en'
      ? 'The AI service is rate-limiting requests. Wait a moment, then try again.'
      : 'AI 服务当前请求过多。请稍等片刻后重试。'
  }
  if (/timeout|timed out/.test(serialized)) {
    return lang === 'en'
      ? 'The classroom teacher timed out. Please try again.'
      : '课堂老师响应超时，请重试。'
  }
  if (/network|fetch|unavailable|busy/.test(serialized)) {
    return lang === 'en'
      ? 'The AI service is temporarily unavailable. Please try again.'
      : 'AI 服务暂时不可用，请重试。'
  }
  return lang === 'en'
    ? 'The classroom teacher could not complete this response. Please try again.'
    : '课堂老师暂时无法完成这次回复，请重试。'
}

/**
 * Chat histories are scoped by surface and active Learning Track. Switching
 * Tracks, entering Review View, or selecting another Review Concept mounts a
 * separate temporary thread instead of leaking context across learning paths.
 * Completed threads are restored when the learner returns during this visit.
 */
export function TeacherChatRuntime({
  children,
  lang,
}: {
  children?: (chat: ReactNode) => ReactNode
  lang: string
}) {
  useLLMConfigBootstrap({ reportErrors: false })
  const { catalog, classroom } = useWorkspace()
  const snapshot = useClassroomSnapshot(classroom)
  const view = useWorkspaceStore(state => state.view)
  const reviewConceptId = useWorkspaceStore(state => state.reviewConceptId)
  const resolvedReviewConceptId = resolveReviewConceptId(
    reviewConceptId,
    snapshot,
    catalog,
  )
  const currentReviewContentVersion = resolvedReviewConceptId
    ? catalog.get(resolvedReviewConceptId)?.version ?? null
    : null
  const activeTrackId = snapshot.activeTrackId
  const reviewing = view === 'review'
  const scope = useMemo<TeacherChatScope>(
    () => reviewing
      && resolvedReviewConceptId
      && currentReviewContentVersion
      ? {
          mode: 'review',
          conceptId: resolvedReviewConceptId,
          contentVersion: currentReviewContentVersion,
          learningTrackId: activeTrackId,
        }
      : { mode: 'live', learningTrackId: activeTrackId },
    [
      activeTrackId,
      currentReviewContentVersion,
      resolvedReviewConceptId,
      reviewing,
    ],
  )
  const scopeKey = scope.mode === 'live'
    ? `live:${scope.learningTrackId ?? 'no-track'}`
    : `review:${scope.conceptId}:${scope.contentVersion}:`
      + `${scope.learningTrackId ?? 'no-track'}`
  const [sessionRuntime] = useState(createTeacherSessionRuntime)
  const historiesRef = useRef(new Map<string, TeacherChatMessage[]>())
  const draftsRef = useRef(new Map<string, string>())
  const runtimeErrorsRef = useRef(new Map<string, string>())
  const rememberHistory = useCallback((messages: TeacherChatMessage[]) => {
    const histories = historiesRef.current
    histories.delete(scopeKey)
    histories.set(scopeKey, [...messages])
    while (histories.size > MAX_CACHED_CHAT_SCOPES) {
      const oldestScope = histories.keys().next().value
      if (oldestScope === undefined)
        break
      histories.delete(oldestScope)
    }
  }, [scopeKey])
  const rememberDraft = useCallback((draft: string) => {
    const drafts = draftsRef.current
    drafts.delete(scopeKey)
    if (draft !== '')
      drafts.set(scopeKey, draft)
    while (drafts.size > MAX_CACHED_CHAT_SCOPES) {
      const oldestScope = drafts.keys().next().value
      if (oldestScope === undefined)
        break
      drafts.delete(oldestScope)
    }
  }, [scopeKey])
  const rememberRuntimeError = useCallback((message: string | null) => {
    const errors = runtimeErrorsRef.current
    errors.delete(scopeKey)
    if (message !== null)
      errors.set(scopeKey, message)
    while (errors.size > MAX_CACHED_CHAT_SCOPES) {
      const oldestScope = errors.keys().next().value
      if (oldestScope === undefined)
        break
      errors.delete(oldestScope)
    }
  }, [scopeKey])
  return (
    <ScopedTeacherChat
      key={scopeKey}
      initialDraft={draftsRef.current.get(scopeKey)}
      initialMessages={historiesRef.current.get(scopeKey)}
      initialRuntimeError={runtimeErrorsRef.current.get(scopeKey)}
      lang={normalizeLang(lang)}
      onDraftChange={rememberDraft}
      onHistoryChange={rememberHistory}
      onRuntimeErrorChange={rememberRuntimeError}
      renderChat={children}
      scope={scope}
      sessionRuntime={sessionRuntime}
    />
  )
}

function ScopedTeacherChat({
  initialDraft,
  initialMessages,
  initialRuntimeError,
  lang,
  onDraftChange,
  onHistoryChange,
  onRuntimeErrorChange,
  renderChat,
  scope,
  sessionRuntime,
}: {
  initialDraft?: string
  initialMessages?: TeacherChatMessage[]
  initialRuntimeError?: string
  lang: TeacherLang
  onDraftChange: (draft: string) => void
  onHistoryChange: (messages: TeacherChatMessage[]) => void
  onRuntimeErrorChange: (message: string | null) => void
  renderChat?: (chat: ReactNode) => ReactNode
  scope: TeacherChatScope
  sessionRuntime: TeacherSessionRuntime
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
  const listPlaygroundTabs = useMemo(() => () =>
    usePlaygroundSession.getState().tabs.map(
      ({ id, title }) => ({ id, title }),
    ), [])
  const dependencies = useMemo<TeacherSessionDependencies>(() => ({
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
  }), [
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
  ])
  const [opened, setOpened] = useState<{
    dependencies: TeacherSessionDependencies
    session: TeacherSession
  } | null>(null)

  useEffect(() => {
    const nextSession = sessionRuntime.open(dependencies)
    // The effect owns the session; the state only projects its transport.
    // eslint-disable-next-line react/set-state-in-effect
    setOpened({ dependencies, session: nextSession })
    return () => {
      nextSession.dispose()
    }
  }, [dependencies, sessionRuntime])

  const session = opened?.dependencies === dependencies
    ? opened.session
    : null

  if (!session)
    return renderChat ? <>{renderChat(null)}</> : null

  return (
    <TeacherChatProjection
      initialDraft={initialDraft}
      initialMessages={initialMessages}
      initialRuntimeError={initialRuntimeError}
      lang={lang}
      onDraftChange={onDraftChange}
      onHistoryChange={onHistoryChange}
      onRuntimeErrorChange={onRuntimeErrorChange}
      renderChat={renderChat}
      session={session}
      scopeMode={scope.mode}
    />
  )
}

function TeacherChatProjection({
  initialDraft,
  initialMessages,
  initialRuntimeError,
  lang,
  onDraftChange,
  onHistoryChange,
  onRuntimeErrorChange,
  renderChat,
  session,
  scopeMode,
}: {
  initialDraft?: string
  initialMessages?: TeacherChatMessage[]
  initialRuntimeError?: string
  lang: TeacherLang
  onDraftChange: (draft: string) => void
  onHistoryChange: (messages: TeacherChatMessage[]) => void
  onRuntimeErrorChange: (message: string | null) => void
  renderChat?: (chat: ReactNode) => ReactNode
  session: TeacherSession
  scopeMode: TeacherChatRunMode
}) {
  const [runtimeError, setRuntimeError] = useState(initialRuntimeError ?? null)
  const runtimeErrorRef = useRef<string | null>(initialRuntimeError ?? null)
  const updateRuntimeError = useCallback((message: string | null) => {
    runtimeErrorRef.current = message
    setRuntimeError(message)
    onRuntimeErrorChange(message)
  }, [onRuntimeErrorChange])
  const runtime = useChatRuntime<TeacherChatMessage>({
    messages: initialMessages,
    onError: (error) => {
      const message = safeTeacherRuntimeError(error, lang)
      if (message !== null)
        updateRuntimeError(message)
    },
    onFinish: ({ isAbort, isError, messages }) => {
      if (isAbort) {
        updateRuntimeError(null)
      }
      else if (isError && runtimeErrorRef.current === null) {
        updateRuntimeError(safeTeacherRuntimeError(null, lang))
      }
      else if (!isError) {
        updateRuntimeError(null)
      }
      onHistoryChange(messages)
    },
    transport: session.transport,
  })
  const dismissRuntimeError = useCallback(() => {
    updateRuntimeError(null)
    requestAnimationFrame(() => {
      document.querySelector<HTMLTextAreaElement>('.aui-composer-input')?.focus()
    })
  }, [updateRuntimeError])
  const clearRuntimeError = useCallback(() => {
    updateRuntimeError(null)
  }, [updateRuntimeError])

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ComposerDraftBridge
        initialDraft={initialDraft}
        onDraftChange={onDraftChange}
        onSend={() => updateRuntimeError(null)}
      />
      <TeacherChatRunScopeBridge mode={scopeMode} />
      <TeacherRuntimeErrorRunBridge
        onRunStart={clearRuntimeError}
        runtimeError={runtimeError}
      />
      <AutoQuotaWatcher />
      <TeacherChatSurface
        lang={lang}
        onDismissRuntimeError={dismissRuntimeError}
        renderChat={renderChat}
        runtimeError={runtimeError}
      />
    </AssistantRuntimeProvider>
  )
}

/** Retrying an errored message should not leave the previous banner visible. */
function TeacherRuntimeErrorRunBridge({
  onRunStart,
  runtimeError,
}: {
  onRunStart: () => void
  runtimeError: string | null
}) {
  const running = useAuiState(state => state.thread.isRunning)
  const wasRunningRef = useRef(false)

  useEffect(() => {
    const started = running && !wasRunningRef.current
    wasRunningRef.current = running
    if (started && runtimeError !== null)
      onRunStart()
  }, [onRunStart, running, runtimeError])

  return null
}

function TeacherChatSurface({
  lang,
  onDismissRuntimeError,
  renderChat,
  runtimeError,
}: {
  lang: TeacherLang
  onDismissRuntimeError: () => void
  renderChat?: (chat: ReactNode) => ReactNode
  runtimeError: string | null
}) {
  const running = useAuiState(state => state.thread.isRunning)
  const hasRenderedMessageError = useAuiState(state =>
    state.thread.messages.some(message => message.status?.type === 'incomplete'),
  )
  const showRuntimeError = runtimeError !== null && !running
  const chat = (
    <TooltipProvider delayDuration={250}>
      <div className="flex h-full min-h-0 flex-col">
        {showRuntimeError && !hasRenderedMessageError && (
          <div
            data-testid="teacher-runtime-error"
            role="alert"
            className="m-3 mb-0 flex items-start gap-2 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-error-foreground dark:bg-destructive/5"
          >
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <p className="min-w-0 flex-1 leading-5">{runtimeError}</p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="-m-1 size-11 shrink-0 lg:size-8"
              aria-label={lang === 'en' ? 'Dismiss error' : '关闭错误提示'}
              onClick={onDismissRuntimeError}
            >
              <X aria-hidden="true" className="size-4" />
            </Button>
          </div>
        )}
        <div className="min-h-0 flex-1">
          <Thread
            allowAttachments={false}
            onDismissMessageError={onDismissRuntimeError}
            showMessageErrors={showRuntimeError}
          />
        </div>
      </div>
    </TooltipProvider>
  )
  return renderChat ? renderChat(chat) : chat
}

/** Keep navigation from silently disposing a request when Chat changes scope. */
function TeacherChatRunScopeBridge({ mode }: { mode: TeacherChatRunMode }) {
  const running = useAuiState(state => state.thread.isRunning)
  const setTeacherChatRunMode = useWorkspaceStore(state => state.setTeacherChatRunMode)

  useEffect(() => {
    setTeacherChatRunMode(running ? mode : null)
    return () => setTeacherChatRunMode(null)
  }, [mode, running, setTeacherChatRunMode])

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

function ComposerDraftBridge({
  initialDraft,
  onDraftChange,
  onSend,
}: {
  initialDraft?: string
  onDraftChange: (draft: string) => void
  onSend: () => void
}) {
  const composer = useComposerRuntime()
  const composerText = useAuiState(state => state.composer.text)
  const pendingPrefill = useWorkspaceStore(state => state.pendingPrefill)
  const pendingPrefillIntent = useWorkspaceStore(
    state => state.pendingPrefillIntent,
  )
  const cancelledDraft = useWorkspaceStore(state => state.cancelledDraft)
  const clearComposerDraft = useWorkspaceStore(state => state.clearComposerDraft)
  const running = useAuiState(state => state.thread.isRunning)
  const workspaceDraft = cancelledDraft ?? pendingPrefill
  const draft = workspaceDraft ?? initialDraft ?? null
  const restoredTextRef = useRef<string | null>(null)
  const hydratedRef = useRef(false)

  useEffect(
    () => composer.unstable_on('send', () => {
      clearComposerDraft()
      composer.setRunConfig({})
      onSend()
    }),
    [clearComposerDraft, composer, onSend],
  )

  useEffect(() => {
    if (pendingPrefill === null || pendingPrefillIntent === null)
      return
    composer.setRunConfig({
      custom: {
        teacherIntent: pendingPrefillIntent.type,
        teacherLearningTrackId: pendingPrefillIntent.learningTrackId,
      },
    })
  }, [composer, pendingPrefill, pendingPrefillIntent])

  useEffect(() => {
    if (running || hydratedRef.current)
      return
    hydratedRef.current = true
    if (draft !== null && composer.getState().text !== draft) {
      restoredTextRef.current = draft
      composer.setText(draft)
    }
  }, [composer, draft, running])

  useEffect(() => {
    if (!hydratedRef.current || workspaceDraft === null || running)
      return
    if (composer.getState().text !== workspaceDraft) {
      restoredTextRef.current = workspaceDraft
      composer.setText(workspaceDraft)
    }
  }, [composer, running, workspaceDraft])

  useEffect(() => {
    if (!hydratedRef.current)
      return
    if (restoredTextRef.current !== null) {
      if (composerText !== restoredTextRef.current)
        return
      restoredTextRef.current = null
    }
    onDraftChange(composerText)
  }, [composerText, onDraftChange])

  useEffect(() => () => {
    onDraftChange(composer.getState().text)
    clearComposerDraft()
    composer.setRunConfig({})
  }, [clearComposerDraft, composer, onDraftChange])

  return null
}
