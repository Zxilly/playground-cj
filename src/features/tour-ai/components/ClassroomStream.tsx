'use client'

import { Trans } from '@lingui/react/macro'
import { t } from '@lingui/core/macro'
import { BookOpenCheck, Check, CircleAlert, Info, Loader2, SkipForward } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import type { ReactNode, Ref } from 'react'
import { useClassroomLiveScrollSurface } from '@/features/tour-ai/context/classroom-live-scroll-surface'
import { LessonBlockView } from '@/features/tour-ai/components/LessonBlockView'
import { ClassroomWelcomeCard } from '@/features/tour-ai/components/ClassroomWelcomeCard'
import { ExercisePracticeCard } from '@/features/tour-ai/components/ExercisePracticeCard'
import type { ClassroomLiveViewItem, ClassroomResolvedContentBlock } from '@/lib/ai/classroom/view-projections'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import type { ClassroomAction } from '@/lib/ai/classroom/reducer'
import type {
  ClassroomEvent,
  ClassroomSession,
  ContentReference,
  ExerciseInstance,
  RunResult,
} from '@/lib/ai/classroom/types'
import { useLLMConfig } from '@/stores/llmConfig'
import { cn } from '@/lib/utils'
import { isLLMConfigReady } from '@/lib/ai/model-provider'
import { getConcept } from '@/lib/ai/concept-graph/loader'

interface ClassroomStreamProps {
  session: ClassroomSession
  lang: string
  dispatch: React.Dispatch<ClassroomAction>
  bridge: AIClassroomBridgeValue
  footer?: ReactNode
  focusExerciseId?: string
  focusExerciseRequestKey?: number
  focusGenerationRequestKey?: number
  focusContinueRequestKey?: number
  generationFocusBlockedReason?: 'api_key' | 'shared_quota'
  suppressGenerationErrorMarkers?: boolean
  onReviewConcept?: (conceptId: string) => void
}

type StreamFooterFocus
  = | { kind: 'generation', blockedReason?: 'api_key' | 'shared_quota' }
    | { kind: 'continue' }

function StreamFooter({
  children,
  focus,
  footerRef,
}: {
  children: ReactNode
  focus: StreamFooterFocus | null
  footerRef: Ref<HTMLDivElement>
}) {
  const focused = focus != null
  return (
    <div
      ref={footerRef}
      tabIndex={-1}
      data-testid="classroom-stream-footer"
      className={cn(
        'scroll-mt-4 pt-1 outline-none',
        focused && 'rounded-md ring-2 ring-tour-link/35 ring-offset-2 ring-offset-tour-bg',
      )}
    >
      {focused && (
        <div
          data-testid={focus.kind === 'generation' ? 'classroom-generation-focus-notice' : 'classroom-continue-focus-notice'}
          role="status"
          className="mb-3 rounded-md border border-tour-border bg-tour-bg px-3 py-2 text-xs font-medium leading-6 text-tour-heading"
        >
          <StreamFooterFocusNotice focus={focus} />
        </div>
      )}
      {children}
    </div>
  )
}

function StreamFooterFocusNotice({ focus }: { focus: StreamFooterFocus }) {
  if (focus.kind === 'continue')
    return <Trans>已回到课堂。可以用下方操作继续下一步、放慢节奏或提问。</Trans>

  return <GenerationFocusNotice blockedReason={focus.blockedReason} />
}

function GenerationFocusNotice({ blockedReason }: { blockedReason?: 'api_key' | 'shared_quota' }) {
  if (blockedReason === 'shared_quota') {
    return (
      <Trans>已回到课堂准备状态。可以继续等待共享额度刷新，或使用自己的 API Key 后继续。</Trans>
    )
  }
  if (blockedReason === 'api_key') {
    return (
      <Trans>已回到课堂准备状态。需要先完成 AI 服务配置，才会继续准备课堂。</Trans>
    )
  }
  return <Trans>已回到课堂准备状态。可以继续等待、重试或检查 AI 设置。</Trans>
}

export function ClassroomStream({ session, lang, dispatch, bridge, footer, focusExerciseId, focusExerciseRequestKey, focusGenerationRequestKey, focusContinueRequestKey, generationFocusBlockedReason, suppressGenerationErrorMarkers = false, onReviewConcept }: ClassroomStreamProps) {
  const config = useLLMConfig()
  const footerRef = useRef<HTMLDivElement>(null)
  const { surface, scrollToExerciseId } = useClassroomLiveScrollSurface()
  const footerFocus: StreamFooterFocus | null = focusGenerationRequestKey != null
    ? { kind: 'generation', blockedReason: generationFocusBlockedReason }
    : focusContinueRequestKey != null ? { kind: 'continue' } : null

  useEffect(() => {
    if (!focusExerciseId || focusExerciseRequestKey == null)
      return
    const frame = window.requestAnimationFrame(() => {
      scrollToExerciseId(focusExerciseId)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [focusExerciseId, focusExerciseRequestKey, scrollToExerciseId])

  useEffect(() => {
    if (focusGenerationRequestKey == null && focusContinueRequestKey == null)
      return
    const frame = window.requestAnimationFrame(() => {
      const footerElement = footerRef.current
      footerElement?.scrollIntoView?.({ block: 'nearest' })
      footerElement?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [focusGenerationRequestKey, focusContinueRequestKey])

  if (session.stream.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl px-2 pb-8">
        <ClassroomWelcomeCard configReady={isLLMConfigReady(config)} />
        {footer && (
          <StreamFooter footerRef={footerRef} focus={footerFocus}>
            {footer}
          </StreamFooter>
        )}
      </div>
    )
  }

  const visibleItems = suppressGenerationErrorMarkers
    ? surface.visibleItems.filter(item => !isLessonGenerationErrorItem(item))
    : surface.visibleItems
  const pendingEventSignatures = new Set(session.eventQueue.map(classroomEventSignature))

  const itemContent = (item: ClassroomLiveViewItem) => (
    <div
      tabIndex={-1}
      data-testid="classroom-stream-item"
      data-live-stream-item-id={item.id}
      data-live-stream-visible-index={item.visibleIndex ?? undefined}
      className="mb-5 scroll-mt-4 rounded-md outline-none focus:ring-2 focus:ring-tour-link/35 focus:ring-offset-2 focus:ring-offset-tour-bg"
    >
      <StreamItemView
        item={item}
        currentExercise={session.currentExercise}
        lang={lang}
        dispatch={dispatch}
        bridge={bridge}
        lastRun={session.lastRun}
        latestRunByExercise={surface.latestRunByExercise}
        onReviewConcept={onReviewConcept}
        isPendingEvent={item.source.type === 'system_event' && pendingEventSignatures.has(classroomEventSignature(item.source.event))}
        focusExerciseRequestKey={item.source.type === 'exercise_instance' && item.source.exercise.id === focusExerciseId
          ? focusExerciseRequestKey
          : undefined}
      />
    </div>
  )

  return (
    <div data-testid="classroom-stream-list" className="min-h-0">
      {visibleItems.map(item => (
        <div key={item.id}>
          {itemContent(item)}
        </div>
      ))}
      {footer && (
        <StreamFooter footerRef={footerRef} focus={footerFocus}>
          {footer}
        </StreamFooter>
      )}
    </div>
  )
}

function isLessonGenerationErrorItem(item: ClassroomLiveViewItem): boolean {
  return item.source.type === 'system_event' && item.source.event.type === 'lesson_generation_error'
}

function StreamItemView({
  item,
  currentExercise,
  lang,
  dispatch,
  bridge,
  lastRun,
  latestRunByExercise,
  onReviewConcept,
  isPendingEvent,
  focusExerciseRequestKey,
}: {
  item: ClassroomLiveViewItem
  currentExercise: ExerciseInstance | null
  lang: string
  dispatch: React.Dispatch<ClassroomAction>
  bridge: AIClassroomBridgeValue
  lastRun: ClassroomSession['lastRun']
  latestRunByExercise: ReadonlyMap<string, RunResult>
  onReviewConcept?: (conceptId: string) => void
  isPendingEvent?: boolean
  focusExerciseRequestKey?: number
}) {
  const source = item.source

  if (source.type === 'content_reference_group') {
    const resolvedBlockIds = new Set(item.resolvedBlocks.map(block => block.blockId))
    const missingReferences = source.references.filter(reference => !resolvedBlockIds.has(reference.blockId))

    return (
      <div className="space-y-4">
        <MissingContentReferencesNotice references={missingReferences} conceptId={source.conceptId} onReviewConcept={onReviewConcept} />
        {item.resolvedBlocks.map(block => (
          <div key={block.blockKey} className="space-y-2">
            <LiveBlockVersionNotice block={block} />
            <LessonBlockView
              block={block.content}
              chapterId={block.content.type === 'heading' ? block.blockKey : undefined}
            />
          </div>
        ))}
      </div>
    )
  }

  if (source.type === 'bridge_note') {
    return (
      <section className="rounded-md border border-tour-border bg-tour-surface p-4 text-sm leading-7">
        {source.body}
      </section>
    )
  }

  if (source.type === 'skip_marker') {
    const skipReason = source.reason
    return (
      <section
        role="status"
        aria-label={t`跳过内容：${skipReason}`}
        data-testid="classroom-stream-skip-marker"
        className="rounded-md border border-tour-border bg-tour-surface p-3 text-xs text-muted-foreground"
      >
        <Trans>已跳过，可在复习中查看：</Trans>
        {' '}
        {skipReason}
      </section>
    )
  }

  if (source.type === 'exercise_instance') {
    return (
      <ExercisePracticeCard
        exercise={source.exercise}
        isActive={Boolean(currentExercise && currentExercise.id === source.exercise.id && currentExercise.status === 'active')}
        lang={lang}
        dispatch={dispatch}
        bridge={bridge}
        lastRun={latestRunByExercise.get(source.exercise.id) ?? (currentExercise?.id === source.exercise.id ? lastRun : null)}
        focusRequestKey={focusExerciseRequestKey}
        onReturnToReview={onReviewConcept}
      />
    )
  }

  if (source.type === 'run_result') {
    return (
      <section className={cn('min-w-0 rounded-md border border-tour-border bg-tour-surface p-4', 'text-sm')}>
        <div className="mb-2 font-semibold"><Trans>运行结果</Trans></div>
        <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded bg-tour-code-bg p-3 font-mono text-xs">
          <Trans>输出：</Trans>
          {source.result.stdout || <Trans>(empty)</Trans>}
        </pre>
      </section>
    )
  }

  if (source.type === 'learning_evidence_marker') {
    const isReviewCheck = source.exerciseIntent === 'review_check'
    const Icon = source.outcome === 'success'
      ? Check
      : source.outcome === 'skip'
        ? SkipForward
        : source.outcome === 'failure'
          ? CircleAlert
          : Info
    const markerClassName = source.outcome === 'success'
      ? 'border-classroom-success-border bg-classroom-success-bg text-classroom-success-fg'
      : source.outcome === 'skip'
        ? 'border-classroom-warning-border bg-classroom-warning-bg text-classroom-warning-fg'
        : source.outcome === 'failure'
          ? 'border-destructive/40 bg-destructive/5 text-destructive'
          : 'border-tour-border bg-tour-surface text-muted-foreground'
    const label = learningEvidenceMarkerLabel(source.outcome, source.strength, isReviewCheck)
    return (
      <section
        role="status"
        aria-label={t`学习记录：${label}`}
        data-testid="classroom-stream-evidence-marker"
        className={cn('inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm', markerClassName)}
      >
        <Icon aria-hidden="true" className="size-4" />
        <span>{label}</span>
      </section>
    )
  }

  if (source.type === 'retention_marker') {
    const retentionSummary = source.summary
    return (
      <section
        role="status"
        aria-label={t`已保存到复习：${retentionSummary}`}
        data-testid="classroom-stream-retention-marker"
        className="rounded-md border border-tour-border bg-tour-surface p-3 text-xs text-muted-foreground"
      >
        <Trans>已保存到复习：</Trans>
        {' '}
        {retentionSummary}
      </section>
    )
  }

  if (source.event.type === 'chat_intent') {
    return <ChatIntentStreamMarker event={source.event} pending={isPendingEvent === true} lang={lang} />
  }

  if (source.event.type === 'lesson_generation_error') {
    return (
      <section
        role="status"
        aria-label={t`准备下一步失败。请重试。`}
        data-testid="classroom-stream-generation-error"
        className="rounded-md border border-tour-border bg-tour-surface p-3 text-xs text-muted-foreground"
      >
        <Trans>准备下一步失败。请重试。</Trans>
      </section>
    )
  }

  if (source.event.type === 'exercise_failure') {
    const failureLabel = source.event.exerciseIntent === 'review_check'
      ? t`复习检查未通过，AI 会给出复习建议。`
      : t`练习提交未通过，AI 会给出下一步建议。`
    return (
      <section
        role="status"
        aria-label={failureLabel}
        data-testid="classroom-stream-exercise-failure"
        className="rounded-md border border-tour-border bg-tour-surface p-3 text-xs text-muted-foreground"
      >
        {failureLabel}
      </section>
    )
  }

  return (
    <section className="rounded-md border border-tour-border bg-tour-surface p-3 text-xs text-muted-foreground">
      <Trans>课堂状态已更新。</Trans>
    </section>
  )
}

function ChatIntentStreamMarker({
  event,
  pending,
  lang,
}: {
  event: Extract<ClassroomEvent, { type: 'chat_intent' }>
  pending: boolean
  lang: string
}) {
  const intentLabel = chatIntentLabel(event.intent)
  const conceptTitle = chatIntentConceptTitle(event.activeConceptId, lang)
  const ariaLabel = pending
    ? conceptTitle ? t`AI 请求已排队：${intentLabel}，范围 ${conceptTitle}` : t`AI 请求已排队：${intentLabel}`
    : conceptTitle ? t`AI 请求已记录：${intentLabel}，范围 ${conceptTitle}` : t`AI 请求已记录：${intentLabel}`
  const detail = pending
    ? t`AI 正在准备下一步；这条 AI 请求不会直接改变学习进度，进度仍由练习提交、复习检查等学习证据决定。`
    : t`这条 AI 请求不会直接改变学习进度；如果已经生成新内容，它会出现在这条记录之后。`

  return (
    <section
      role="status"
      aria-label={ariaLabel}
      aria-busy={pending ? 'true' : undefined}
      data-testid="classroom-stream-chat-intent-marker"
      className="flex min-w-0 items-start gap-2 rounded-md border border-tour-border bg-tour-surface p-3 text-xs leading-6 text-muted-foreground"
    >
      {pending
        ? <Loader2 aria-hidden="true" className="mt-1 size-4 shrink-0 animate-spin text-tour-accent-fg" />
        : <Info aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted-foreground" />}
      <div className="min-w-0 break-words">
        <div className="font-semibold text-tour-heading">
          <Trans>已收到：</Trans>
          {intentLabel}
        </div>
        {conceptTitle && (
          <div>
            <Trans>范围：</Trans>
            {conceptTitle}
          </div>
        )}
        <div>{detail}</div>
      </div>
    </section>
  )
}

function chatIntentConceptTitle(conceptId: string | undefined, lang: string): string | null {
  if (!conceptId)
    return null
  const concept = getConcept(conceptId)
  if (!concept)
    return conceptId
  return lang === 'en' ? concept.title.en : concept.title.zh
}

function chatIntentLabel(intent: Extract<ClassroomEvent, { type: 'chat_intent' }>['intent']): string {
  switch (intent) {
    case 'advance':
      return t`继续下一步`
    case 'go_deeper':
      return t`再深入讲讲`
    case 'slow_down':
      return t`讲慢一点`
    case 'change_topic':
      return t`调整主题`
    case 'explain_error':
      return t`帮我看看错在哪`
    case 'review_check':
      return t`开始复习检查`
    default: {
      const _exhaustive: never = intent
      void _exhaustive
      return t`AI 请求`
    }
  }
}

function classroomEventSignature(event: ClassroomEvent): string {
  return `${event.type}:${event.createdAt}:${event.summary ?? ''}`
}

function MissingContentReferencesNotice({ references, conceptId, onReviewConcept }: { references: ContentReference[], conceptId: string, onReviewConcept?: (conceptId: string) => void }) {
  const detailId = useId()
  const actionDescriptionId = useId()
  if (references.length === 0)
    return null

  const missingBlockIds = references.map(reference => reference.blockId).join(', ')
  const reviewActionDescription = t`切换到复习视图，查看概念掌握和保留练习；不会改变学习进度或排队新的 AI 请求。`

  return (
    <section
      role="status"
      aria-label={t`缺失课堂内容：${missingBlockIds}`}
      aria-describedby={`${detailId}${onReviewConcept ? ` ${actionDescriptionId}` : ''}`}
      data-testid="live-block-missing-content"
      className="flex min-w-0 flex-col gap-2 break-words rounded-md border border-classroom-warning-border bg-classroom-warning-bg px-3 py-2 text-xs leading-6 text-classroom-warning-fg sm:flex-row sm:items-start sm:justify-between"
    >
      <div className="min-w-0">
        <div className="font-semibold">
          <Trans>部分课堂内容暂时无法显示</Trans>
        </div>
        <p id={detailId} className="mt-1 break-words">
          <Trans>
            这条历史课堂记录引用的内容块在当前内容包中找不到。课堂记录仍会保留；你可以在复习页查看当前已验证内容。缺失内容块：
            {' '}
            {missingBlockIds}
            。
          </Trans>
        </p>
      </div>
      {onReviewConcept && (
        <>
          <span id={actionDescriptionId} className="sr-only">{reviewActionDescription}</span>
          <button
            type="button"
            aria-describedby={`${detailId} ${actionDescriptionId}`}
            title={reviewActionDescription}
            onClick={() => onReviewConcept(conceptId)}
            className="inline-flex w-full max-w-full shrink-0 items-center justify-center gap-1.5 rounded-md border border-classroom-warning-border bg-tour-surface px-2.5 py-1.5 text-xs font-semibold text-classroom-warning-fg hover:bg-classroom-warning-bg sm:w-auto"
          >
            <BookOpenCheck aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="min-w-0 break-words"><Trans>去复习</Trans></span>
          </button>
        </>
      )}
    </section>
  )
}

function LiveBlockVersionNotice({ block }: { block: ClassroomResolvedContentBlock }) {
  const detailId = useId()
  if (!block.versionMismatch)
    return null

  const encounteredVersion = block.encounteredContentVersion
  const currentVersion = block.currentContentVersion

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        aria-describedby={detailId}
        className="inline-flex rounded border border-classroom-warning-border bg-classroom-warning-bg px-1.5 py-0.5 text-[10px] font-medium text-classroom-warning-fg"
      >
        <Trans>内容已更新</Trans>
      </span>
      <span
        id={detailId}
        data-testid="live-block-version-notice"
        className="inline-flex rounded border border-classroom-warning-border bg-classroom-warning-bg px-1.5 py-0.5 text-[10px] text-classroom-warning-fg"
      >
        <Trans>
          课堂记录版本
          {' '}
          {encounteredVersion}
          {' '}
          ，当前显示版本
          {' '}
          {currentVersion}
          。
        </Trans>
      </span>
    </div>
  )
}

function learningEvidenceMarkerLabel(
  outcome: Extract<ClassroomSession['stream'][number], { type: 'learning_evidence_marker' }>['outcome'],
  strength: Extract<ClassroomSession['stream'][number], { type: 'learning_evidence_marker' }>['strength'],
  isReviewCheck: boolean,
) {
  if (isReviewCheck) {
    if (outcome === 'success' && strength === 'mastery')
      return t`复习检查通过，已记录掌握证据`
    if (outcome === 'success')
      return t`复习检查完成已记录`
    if (outcome === 'skip')
      return t`已记录跳过复习检查`
    if (outcome === 'failure')
      return t`复习检查尝试未通过，已记录`
    return t`复习检查尝试已记录`
  }

  if (outcome === 'success')
    return t`练习完成已记录`
  if (outcome === 'skip')
    return t`已记录跳过练习`
  if (outcome === 'failure')
    return t`练习尝试未通过，已记录`
  return t`学习记录已更新`
}
