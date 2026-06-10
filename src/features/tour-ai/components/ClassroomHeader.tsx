'use client'

import { useId, useMemo } from 'react'
import type { KeyboardEvent } from 'react'
import { BookOpenCheck, BookOpenText, MessageCircle, PlayCircle, Settings } from 'lucide-react'
import { useLLMConfigStore } from '@/stores/llmConfig'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { ClassroomBrandChip } from '@/features/tour-ai/components/ClassroomBrandChip'
import { ClassroomConceptPanel } from '@/features/tour-ai/components/ClassroomConceptPanel'
import { ClassroomThemeToggle } from '@/features/tour-ai/components/ClassroomThemeToggle'
import { useClassroomSession } from '@/features/tour-ai/context/classroom-session-context'
import { deriveActiveConceptId, deriveLatestHeading } from '@/lib/ai/classroom/selectors'
import type { ClassroomPhase } from '@/lib/ai/classroom/types'
import { LLMConfigDialog } from '@/modules/llm-config/components/LLMConfigDialog'
import { getStaticTourSourceHref } from '@/lib/ai/course-content/static-tour-links'
import { AI_CLASSROOM_VIEW_PANEL_IDS, AI_CLASSROOM_VIEW_TAB_IDS } from './classroom-view-tabs'

interface ClassroomHeaderProps {
  onOpenChat: () => void
  chatDisabledReason?: ClassroomChatDisabledReason
  activeView: 'live' | 'review'
  onViewChange: (view: 'live' | 'review') => void
  onReviewConcept: (conceptId: string) => void
  onReturnToCurrentExercise?: () => void
  previewOnly?: boolean
  onStartClassroom?: () => void
  activeConceptIdOverride?: string
  /** Slot for ClassroomChapterIndex; wired up in Task 7.3. */
  chapterIndex?: React.ReactNode
}

type ClassroomChatDisabledReason = 'lesson_generation' | 'api_key' | 'shared_quota'

export function ClassroomHeader({
  onOpenChat,
  chatDisabledReason,
  activeView,
  onViewChange,
  onReviewConcept,
  onReturnToCurrentExercise,
  previewOnly = false,
  onStartClassroom,
  activeConceptIdOverride,
  chapterIndex,
}: ClassroomHeaderProps) {
  const { session } = useClassroomSession()
  const latestHeading = useMemo(() => deriveLatestHeading(session), [session])
  const sessionActiveConceptId = useMemo(() => deriveActiveConceptId(session), [session])
  const activeConceptId = activeConceptIdOverride ?? sessionActiveConceptId
  const sourceHref = useMemo(() => {
    if (!activeConceptId || typeof window === 'undefined')
      return null
    return getStaticTourSourceHref(session.lang, {
      conceptId: activeConceptId,
      currentOrigin: window.location.origin,
    })
  }, [activeConceptId, session.lang])
  const openSettings = useLLMConfigStore(state => state.setSettingsDialogOpen)
  const sourceDescriptionId = useId()
  const settingsDescriptionId = useId()
  const chatDescriptionId = useId()
  const startClassroomDescriptionId = useId()
  const liveTabDescription = previewOnly
    ? t`当前处于课程预览；需要使用“开始课堂”按钮确认后才会启动 AI 课堂并准备下一步内容。`
    : t`切换到课堂视图，只查看当前课堂流；不会改变学习进度或排队新的 AI 请求。`
  const reviewTabDescription = previewOnly
    ? t`切换到复习视图，查看课程预览和已保留的练习；不会开始 AI 课堂或记录学习进度。`
    : t`切换到复习视图，查看概念掌握和保留练习；不会改变学习进度或排队新的 AI 请求。`
  const chatDescription = chatDisabledReason
    ? chatDisabledDescription(chatDisabledReason)
    : activeConceptId
      ? t`打开聊天；AI 会优先使用当前课堂概念作为上下文。`
      : t`打开聊天；AI 会使用当前课堂内容作为上下文。`
  const focusViewTab = (view: 'live' | 'review') => {
    onViewChange(view)
    window.requestAnimationFrame(() => {
      document.getElementById(AI_CLASSROOM_VIEW_TAB_IDS[view])?.focus()
    })
  }
  const handleViewTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, view: 'live' | 'review') => {
    const nextView = event.key === 'ArrowLeft' || event.key === 'ArrowRight'
      ? (view === 'live' ? 'review' : 'live')
      : event.key === 'Home'
        ? 'live'
        : event.key === 'End'
          ? 'review'
          : null
    if (!nextView)
      return
    event.preventDefault()
    if (previewOnly && nextView === 'live') {
      document.getElementById(AI_CLASSROOM_VIEW_TAB_IDS.live)?.focus()
      return
    }
    focusViewTab(nextView)
  }
  return (
    <header
      data-testid="ai-classroom-header"
      className="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b border-tour-border bg-tour-surface px-3 py-2 sm:h-12 sm:flex-nowrap sm:px-5 sm:py-0"
    >
      <div className="flex min-w-0 flex-1 basis-full items-center gap-2 sm:basis-auto sm:gap-3">
        <ClassroomBrandChip />
        {latestHeading && (
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            ·
            {' '}
            {latestHeading}
          </span>
        )}
        <PhaseBadge phase={session.phase} />
      </div>
      <div className="flex min-w-0 flex-1 basis-full items-center gap-1 overflow-x-auto overscroll-x-contain whitespace-nowrap sm:basis-auto sm:justify-end">
        <div className="mr-1 inline-flex shrink-0 rounded-md border border-tour-border bg-tour-bg p-0.5 sm:mr-2" role="tablist" aria-label={t`课堂视图`}>
          <ViewTab
            id={AI_CLASSROOM_VIEW_TAB_IDS.live}
            active={activeView === 'live'}
            onClick={() => onViewChange('live')}
            onKeyDown={event => handleViewTabKeyDown(event, 'live')}
            controls={AI_CLASSROOM_VIEW_PANEL_IDS.live}
            icon={<PlayCircle aria-hidden="true" className="size-3.5" />}
            label={t`课堂`}
            description={liveTabDescription}
            title={liveTabDescription}
            disabled={previewOnly}
          />
          <ViewTab
            id={AI_CLASSROOM_VIEW_TAB_IDS.review}
            active={activeView === 'review'}
            onClick={() => onViewChange('review')}
            onKeyDown={event => handleViewTabKeyDown(event, 'review')}
            controls={AI_CLASSROOM_VIEW_PANEL_IDS.review}
            icon={<BookOpenCheck aria-hidden="true" className="size-3.5" />}
            label={t`复习`}
            description={reviewTabDescription}
            title={reviewTabDescription}
          />
        </div>
        {sourceHref && (
          <>
            <a
              href={sourceHref}
              aria-label={t`打开对应教程`}
              aria-describedby={sourceDescriptionId}
              title={t`打开当前概念对应的静态教程内容，不会改变 AI 课堂进度。`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-tour-border bg-tour-surface px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-tour-bg"
            >
              <BookOpenText aria-hidden="true" className="size-4 shrink-0" />
              <span className="hidden sm:inline"><Trans>教程</Trans></span>
            </a>
            <span id={sourceDescriptionId} className="sr-only">
              <Trans>打开当前概念对应的静态教程内容，不会改变 AI 课堂进度。</Trans>
            </span>
          </>
        )}
        <ClassroomConceptPanel
          lang={session.lang}
          onReviewConcept={onReviewConcept}
          onReturnToCurrentExercise={onReturnToCurrentExercise}
        />
        {chapterIndex}
        <ClassroomThemeToggle />
        <button
          type="button"
          aria-label={t`AI 服务设置`}
          aria-describedby={settingsDescriptionId}
          title={t`打开 AI 服务设置，用于检查服务地址、API Key、模型和共享额度。`}
          onClick={() => openSettings(true)}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-tour-bg"
        >
          <Settings aria-hidden="true" className="size-4 shrink-0" />
        </button>
        <span id={settingsDescriptionId} className="sr-only">
          <Trans>打开 AI 服务设置，用于检查服务地址、API Key、模型和共享额度。</Trans>
        </span>
        {previewOnly
          ? (
              <>
                <button
                  type="button"
                  aria-label={t`开始 AI 课堂`}
                  aria-describedby={startClassroomDescriptionId}
                  title={t`开始 AI 课堂并准备下一步内容，预览内容仍可在复习页查看。`}
                  onClick={onStartClassroom ?? (() => onViewChange('live'))}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center gap-2 rounded-md border border-tour-border bg-tour-surface text-xs font-medium text-tour-heading hover:bg-tour-bg sm:w-auto sm:px-3"
                >
                  <PlayCircle aria-hidden="true" className="size-4 shrink-0" />
                  <span className="hidden sm:inline"><Trans>开始课堂</Trans></span>
                </button>
                <span id={startClassroomDescriptionId} className="sr-only">
                  <Trans>开始 AI 课堂并准备下一步内容，预览内容仍可在复习页查看。</Trans>
                </span>
              </>
            )
          : (
              <>
                <button
                  type="button"
                  aria-label={t`打开聊天`}
                  aria-describedby={chatDescriptionId}
                  title={chatDescription}
                  onClick={onOpenChat}
                  disabled={chatDisabledReason != null}
                  className="inline-flex shrink-0 items-center gap-2 rounded-md border border-tour-border bg-tour-surface px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-tour-bg disabled:cursor-not-allowed disabled:opacity-50 sm:px-3"
                >
                  <MessageCircle aria-hidden="true" className="size-4 shrink-0" />
                  <span className="hidden sm:inline"><Trans>聊天</Trans></span>
                </button>
                <span id={chatDescriptionId} className="sr-only">
                  {chatDescription}
                </span>
              </>
            )}
      </div>
      {/* The dialog is store-controlled, so it only needs to be mounted; our
          own settings button above drives `setSettingsDialogOpen(true)`. */}
      <LLMConfigDialog withTrigger={false} />
    </header>
  )
}

function chatDisabledDescription(reason: ClassroomChatDisabledReason): string {
  if (reason === 'api_key')
    return t`请先完成 AI 服务配置；课堂准备完成后再打开聊天。`
  if (reason === 'shared_quota')
    return t`共享额度恢复后再打开聊天；课堂准备完成前不会开始新的聊天。`
  return t`课堂正在准备内容；准备完成后再打开聊天，避免在没有课堂上下文时提问。`
}

function ViewTab({
  id,
  active,
  onClick,
  onKeyDown,
  controls,
  icon,
  label,
  description,
  title,
  disabled = false,
}: {
  id: string
  active: boolean
  onClick: () => void
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
  controls: string
  icon: React.ReactNode
  label: string
  description?: string
  title?: string
  disabled?: boolean
}) {
  const descriptionId = useId()
  return (
    <>
      <button
        id={id}
        type="button"
        role="tab"
        aria-selected={active}
        aria-controls={controls}
        aria-label={label}
        aria-describedby={description ? descriptionId : undefined}
        aria-disabled={disabled || undefined}
        title={title}
        tabIndex={active ? 0 : -1}
        onClick={disabled ? undefined : onClick}
        onKeyDown={onKeyDown}
        className="inline-flex shrink-0 items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-muted-foreground aria-disabled:cursor-not-allowed aria-disabled:opacity-60 aria-selected:bg-tour-surface aria-selected:text-tour-text"
      >
        {icon}
        <span className="hidden sm:inline">{label}</span>
      </button>
      {description && (
        <span id={descriptionId} className="sr-only">
          {description}
        </span>
      )}
    </>
  )
}

function PhaseBadge({ phase }: { phase: ClassroomPhase }) {
  const label = phase === 'orient'
    ? t`准备`
    : phase === 'teach'
      ? t`讲解`
      : phase === 'practice'
        ? t`练习`
        : t`复习`
  return (
    <span
      data-testid="classroom-phase"
      className="shrink-0 rounded border border-tour-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
    >
      {label}
    </span>
  )
}
