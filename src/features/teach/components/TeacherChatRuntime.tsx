'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AssistantRuntimeProvider, useAuiState, useComposerRuntime } from '@assistant-ui/react'
import { useChatRuntime } from '@assistant-ui/react-ai-sdk'
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
  const resolvedReviewConceptId = resolveReviewConceptId(
    reviewConceptId,
    snapshot,
    catalog,
  )
  const currentReviewContentVersion = resolvedReviewConceptId
    ? catalog.get(resolvedReviewConceptId)?.version ?? null
    : null
  const activeTrackId = snapshot.activeTrackId
  const scope = useMemo<TeacherChatScope>(
    () => view === 'review'
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
      view,
    ],
  )
  const scopeKey = scope.mode === 'live'
    ? `live:${scope.learningTrackId ?? 'no-track'}`
    : `review:${scope.conceptId}:${scope.contentVersion}:`
      + `${scope.learningTrackId ?? 'no-track'}`
  const [sessionRuntime] = useState(createTeacherSessionRuntime)
  return (
    <ScopedTeacherChat
      key={scopeKey}
      lang={normalizeLang(lang)}
      scope={scope}
      sessionRuntime={sessionRuntime}
    />
  )
}

function ScopedTeacherChat({
  lang,
  scope,
  sessionRuntime,
}: {
  lang: TeacherLang
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
    return null

  return <TeacherChatProjection session={session} />
}

function TeacherChatProjection({ session }: { session: TeacherSession }) {
  const runtime = useChatRuntime<TeacherChatMessage>({
    transport: session.transport,
  })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ComposerPrefillBridge />
      <AutoQuotaWatcher />
      <TooltipProvider delayDuration={250}>
        <Thread allowAttachments={false} />
      </TooltipProvider>
    </AssistantRuntimeProvider>
  )
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
