'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AssistantRuntimeProvider, useAui, useAuiEvent, useAuiState } from '@assistant-ui/react'
import { useChatRuntime } from '@assistant-ui/react-ai-sdk'
import { CircleAlert, Settings2, X } from 'lucide-react'
import type { I18n } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Thread } from '@/modules/assistant-ui/chat/Thread'
import type { ThreadWelcomeSuggestion } from '@/modules/assistant-ui/chat/ThreadWelcome'
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

interface TeacherRuntimeErrorState {
  message: string
  openSettings?: boolean
}

function readHttpStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object')
    return null
  const candidate = error as { statusCode?: unknown, status?: unknown }
  if (typeof candidate.statusCode === 'number')
    return candidate.statusCode
  if (typeof candidate.status === 'number')
    return candidate.status
  return null
}

function safeTeacherRuntimeError(error: unknown, i18n: I18n): TeacherRuntimeErrorState | null {
  const status = readHttpStatus(error)
  const serialized = String(
    error instanceof Error ? `${error.name} ${error.message}` : error ?? '',
  ).toLowerCase()
  if (/abort|cancel|user aborted/.test(serialized))
    return null
  if (
    status === 401
    || status === 403
    || /\b(?:401|403)\b|unauthori[sz]ed|forbidden|invalid.?api.?key|authentication|permission.?denied/.test(serialized)
  ) {
    return {
      message: i18n._(msg`API Key 无效或无权限访问当前服务。请前往“AI 服务设置”检查密钥与权限。`),
      openSettings: true,
    }
  }
  if (
    status === 404
    || /\b404\b|not.?found|model_not_found|no such model/.test(serialized)
  ) {
    return {
      message: i18n._(msg`未找到所配置的模型或接口地址（404）。请前往“AI 服务设置”检查服务地址与模型名称。`),
      openSettings: true,
    }
  }
  if (status === 429 || /\b429\b|rate.?limit|quota|too many requests/.test(serialized)) {
    return {
      message: i18n._(msg`AI 服务当前请求过多。请稍等片刻后重试。`),
      openSettings: true,
    }
  }
  if (/timeout|timed out/.test(serialized)) {
    return {
      message: i18n._(msg`课堂老师响应超时，请重试。`),
    }
  }
  if (/network|fetch|unavailable|busy/.test(serialized)) {
    return {
      message: i18n._(msg`AI 服务暂时不可用，请重试。`),
    }
  }
  return {
    message: i18n._(msg`课堂老师暂时无法完成这次回复，请重试。`),
  }
}

function buildTeacherSuggestions({
  conceptTitle,
  hasActiveTrack,
  i18n,
  scopeMode,
  view,
}: {
  conceptTitle: string | null
  hasActiveTrack: boolean
  i18n: I18n
  scopeMode: TeacherChatRunMode
  view: 'live' | 'review' | 'progress' | 'playground'
}): readonly ThreadWelcomeSuggestion[] {
  if (scopeMode === 'review' && conceptTitle) {
    return [
      {
        title: i18n._(msg`通俗讲解「${conceptTitle}」`),
        description: i18n._(msg`用一个简短可运行的仓颉示例带我理解核心要点`),
        prompt: i18n._(msg`请结合一个最简仓颉示例，循序渐进地讲解「${conceptTitle}」。`),
      },
      {
        title: i18n._(msg`常见易错点`),
        description: i18n._(msg`总结初学者最容易踩的坑与避坑建议`),
        prompt: i18n._(msg`学习「${conceptTitle}」时最常见有哪些误区或报错？应该怎样避免？`),
      },
      {
        title: i18n._(msg`出题检验理解`),
        description: i18n._(msg`用一个小问题帮我确认是否真正掌握`),
        prompt: i18n._(msg`请围绕「${conceptTitle}」给我出一个简短的检验问题，帮我确认掌握情况。`),
      },
      {
        title: i18n._(msg`跨语言对比`),
        description: i18n._(msg`对比 C / Java / Go / Rust 中的对应概念`),
        prompt: i18n._(msg`仓颉中的「${conceptTitle}」和 Go、Rust 或 Java 相比有什么异同？`),
      },
    ]
  }

  if (view === 'playground') {
    return [
      {
        title: i18n._(msg`点评当前练习场代码`),
        description: i18n._(msg`读取我正在编辑的代码并给出清晰改进建议`),
        prompt: i18n._(msg`请查看我当前练习场编辑器中的仓颉代码，指出潜在问题并给出改进建议。`),
      },
      {
        title: i18n._(msg`排查编译报错`),
        description: i18n._(msg`帮我定位代码为什么编译不通过或输出不符`),
        prompt: i18n._(msg`我当前练习场里的代码运行或编译遇到问题，请帮我分析原因并给出修改思路。`),
      },
      {
        title: i18n._(msg`来道小程序挑战`),
        description: i18n._(msg`出一个 10 行左右的仓颉小题目练练手`),
        prompt: i18n._(msg`请给我出一道适合在练习场直接编写运行的仓颉小程序挑战题。`),
      },
    ]
  }

  if (hasActiveTrack) {
    return [
      {
        title: i18n._(msg`继续当前课程`),
        description: i18n._(msg`按我的学习路径推进下一步讲解或练习`),
        prompt: i18n._(msg`请按我当前的学习路径，继续下一步的讲解或练习。`),
      },
      {
        title: i18n._(msg`放慢节奏举个例子`),
        description: i18n._(msg`把当前概念拆细，用简单示例演示`),
        prompt: i18n._(msg`可以放慢一点节奏，用一个更简单的仓颉例子解释当前知识点吗？`),
      },
      {
        title: i18n._(msg`安排一道动手练习`),
        description: i18n._(msg`通过写代码检验刚刚学到的内容`),
        prompt: i18n._(msg`我准备好做一道当前知识点的动手练习了。`),
      },
      {
        title: i18n._(msg`总结本节要点`),
        description: i18n._(msg`梳理核心语法和注意事项方便复习`),
        prompt: i18n._(msg`请帮我总结目前这一节的核心语法要点和注意事项。`),
      },
    ]
  }

  return [
    {
      title: i18n._(msg`这门课包含哪些内容？`),
      description: i18n._(msg`了解内置入门知识点和推荐学习节奏`),
      prompt: i18n._(msg`当前 AI 课堂内置了哪些仓颉知识点？我应该从哪里开始学？`),
    },
    {
      title: i18n._(msg`main() 入口怎么写？`),
      description: i18n._(msg`快速了解仓颉程序的最小可运行结构`),
      prompt: i18n._(msg`仓颉程序的 main() 入口有什么特点？可以给我看一个最小例子吗？`),
    },
    {
      title: i18n._(msg`let 和 var 有什么区别？`),
      description: i18n._(msg`区分不可变绑定与可变变量的使用场景`),
      prompt: i18n._(msg`仓颉里 let 和 var 有什么区别？分别适合什么场景？`),
    },
  ]
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
  const { i18n } = useLingui()
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
  const runtimeErrorsRef = useRef(new Map<string, TeacherRuntimeErrorState>())
  const normalizedLang = normalizeLang(lang)
  const reviewConceptTitle = scope.mode === 'review'
    ? catalog.get(scope.conceptId)?.concept.title ?? null
    : null
  const suggestions = useMemo(
    () => buildTeacherSuggestions({
      conceptTitle: reviewConceptTitle,
      hasActiveTrack: activeTrackId !== null,
      i18n,
      scopeMode: scope.mode,
      view,
    }),
    [activeTrackId, i18n, reviewConceptTitle, scope.mode, view],
  )
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
  const rememberRuntimeError = useCallback((nextError: TeacherRuntimeErrorState | null) => {
    const errors = runtimeErrorsRef.current
    errors.delete(scopeKey)
    if (nextError !== null)
      errors.set(scopeKey, nextError)
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
      lang={normalizedLang}
      onDraftChange={rememberDraft}
      onHistoryChange={rememberHistory}
      onRuntimeErrorChange={rememberRuntimeError}
      renderChat={children}
      scope={scope}
      sessionRuntime={sessionRuntime}
      suggestions={suggestions}
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
  suggestions,
}: {
  initialDraft?: string
  initialMessages?: TeacherChatMessage[]
  initialRuntimeError?: TeacherRuntimeErrorState
  lang: TeacherLang
  onDraftChange: (draft: string) => void
  onHistoryChange: (messages: TeacherChatMessage[]) => void
  onRuntimeErrorChange: (error: TeacherRuntimeErrorState | null) => void
  renderChat?: (chat: ReactNode) => ReactNode
  scope: TeacherChatScope
  sessionRuntime: TeacherSessionRuntime
  suggestions: readonly ThreadWelcomeSuggestion[]
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
      suggestions={suggestions}
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
  suggestions,
}: {
  initialDraft?: string
  initialMessages?: TeacherChatMessage[]
  initialRuntimeError?: TeacherRuntimeErrorState
  lang: TeacherLang
  onDraftChange: (draft: string) => void
  onHistoryChange: (messages: TeacherChatMessage[]) => void
  onRuntimeErrorChange: (error: TeacherRuntimeErrorState | null) => void
  renderChat?: (chat: ReactNode) => ReactNode
  session: TeacherSession
  scopeMode: TeacherChatRunMode
  suggestions: readonly ThreadWelcomeSuggestion[]
}) {
  const { i18n } = useLingui()
  const [runtimeError, setRuntimeError] = useState<TeacherRuntimeErrorState | null>(initialRuntimeError ?? null)
  const runtimeErrorRef = useRef<TeacherRuntimeErrorState | null>(initialRuntimeError ?? null)
  const updateRuntimeError = useCallback((nextError: TeacherRuntimeErrorState | null) => {
    runtimeErrorRef.current = nextError
    setRuntimeError(nextError)
    onRuntimeErrorChange(nextError)
  }, [onRuntimeErrorChange])
  const runtime = useChatRuntime<TeacherChatMessage>({
    messages: initialMessages,
    onError: (error) => {
      const nextError = safeTeacherRuntimeError(error, i18n)
      if (nextError !== null)
        updateRuntimeError(nextError)
    },
    onFinish: ({ isAbort, isError, messages }) => {
      if (isAbort) {
        updateRuntimeError(null)
      }
      else if (isError && runtimeErrorRef.current === null) {
        updateRuntimeError(safeTeacherRuntimeError(null, i18n))
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
        suggestions={suggestions}
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
  runtimeError: TeacherRuntimeErrorState | null
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
  onDismissRuntimeError,
  renderChat,
  runtimeError,
  suggestions,
}: {
  lang?: TeacherLang
  onDismissRuntimeError: () => void
  renderChat?: (chat: ReactNode) => ReactNode
  runtimeError: TeacherRuntimeErrorState | null
  suggestions: readonly ThreadWelcomeSuggestion[]
}) {
  const { t } = useLingui()
  const setSettingsDialogOpen = useLLMConfigStore(state => state.setSettingsDialogOpen)
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
            <div className="min-w-0 flex-1">
              <p className="leading-5">{runtimeError.message}</p>
              {runtimeError.openSettings && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid="teacher-runtime-error-settings"
                  className="mt-2 min-h-9 border-destructive/40 bg-background text-xs text-foreground hover:bg-muted"
                  onClick={() => setSettingsDialogOpen?.(true)}
                >
                  <Settings2 aria-hidden="true" className="size-3.5" />
                  <Trans>打开 AI 服务设置</Trans>
                </Button>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="-m-1 size-11 shrink-0 lg:size-8"
              aria-label={t`关闭错误提示`}
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
            suggestions={suggestions}
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
  const composer = useAui().composer
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

  useAuiEvent('composer.send', () => {
    clearComposerDraft()
    composer.setRunConfig({})
    onSend()
  })

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
