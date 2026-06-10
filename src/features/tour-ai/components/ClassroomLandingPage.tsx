'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { ArrowRight, BookOpenCheck, CircleAlert, Code2, GraduationCap, MessagesSquare, RotateCcw, Settings2, Sparkles } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { useLLMConfig, useLLMConfigStore } from '@/stores/llmConfig'
import { ClassroomBrandChip } from '@/features/tour-ai/components/ClassroomBrandChip'
import { ClassroomPersistenceBanner } from '@/features/tour-ai/components/ClassroomPersistenceBanner'
import type { ClassroomSessionHydrationIssue, ClassroomSessionSaveIssue } from '@/lib/ai/classroom/use-persistent-session'
import { isLLMConfigReady } from '@/lib/ai/model-provider'
import { formatResetMoment } from '@/modules/llm-config/runtime/format-reset-moment'

interface ClassroomLandingPageProps {
  hasClassroomSession: boolean
  topicTitle?: string
  topicUnavailable?: boolean
  sourceHref?: string
  persistenceIssue?: ClassroomSessionHydrationIssue | null
  saveIssue?: ClassroomSessionSaveIssue | null
  onEnter: () => void
  onPreview?: () => void
  onRetrySave?: () => Promise<void> | void
  onResetSession?: () => void
}

export function ClassroomLandingPage({
  hasClassroomSession,
  topicTitle,
  topicUnavailable = false,
  sourceHref,
  persistenceIssue = null,
  saveIssue = null,
  onEnter,
  onPreview,
  onRetrySave,
  onResetSession,
}: ClassroomLandingPageProps) {
  const [resetConfirming, setResetConfirming] = useState(false)
  const resetButtonRef = useRef<HTMLButtonElement>(null)
  const keepRecordButtonRef = useRef<HTMLButtonElement>(null)
  const config = useLLMConfig()
  const keySource = useLLMConfigStore(state => state.keySource)
  const autoQuota = useLLMConfigStore(state => state.autoQuota)
  const openSettings = useLLMConfigStore(state => state.setSettingsDialogOpen)
  const configReady = isLLMConfigReady(config)
  const sharedQuotaExhausted = keySource === 'auto' && autoQuota?.exhausted === true
  const aiServiceNeedsRecovery = !configReady || sharedQuotaExhausted
  const canStartNewClassroom = configReady && !sharedQuotaExhausted
  const canEnter = hasClassroomSession || canStartNewClassroom
  const quotaResetMoment = autoQuota?.nextResetAt ? formatResetMoment(autoQuota.nextResetAt) : ''
  const configHintId = useId()
  const quotaHintId = useId()
  const previewHintId = useId()
  const sessionServiceIssueId = useId()
  const resetConfirmTitleId = useId()
  const resetConfirmDescriptionId = useId()
  const sessionServiceRecoveryDescriptionId = hasClassroomSession && aiServiceNeedsRecovery
    ? sessionServiceIssueId
    : undefined
  const blockedActionDescriptionId = !hasClassroomSession && !configReady
    ? configHintId
    : !hasClassroomSession && configReady && sharedQuotaExhausted ? quotaHintId : undefined
  const sourceActionTitle = t`打开对应静态教程；不会改变 AI 课堂进度。`
  const settingsActionTitle = sharedQuotaExhausted
    ? quotaResetMoment
      ? t`打开 AI 服务设置，改用自己的 API Key 后可立刻继续；不会进入课堂或排队新的 AI 请求。共享额度下次刷新：${quotaResetMoment}。`
      : t`打开 AI 服务设置，改用自己的 API Key 后可立刻继续；不会进入课堂或排队新的 AI 请求。`
    : t`打开 AI 服务设置，完成服务地址、API Key 和模型配置；不会进入课堂或排队新的 AI 请求。`
  const primaryActionTitle = canEnter
    ? hasClassroomSession
      ? aiServiceNeedsRecovery
        ? sharedQuotaExhausted
          ? t`继续打开已保存课堂；已有内容、复习内容和练习记录会保留。新的 AI 内容需要等待额度刷新或使用自己的 API Key。`
          : t`继续打开已保存课堂；已有内容、复习内容和练习记录会保留。聊天、生成下一步和复习检查需要先完成 AI 服务配置。`
        : t`继续打开已保存课堂；不会重置进度、复习内容或练习记录。`
      : t`开始 AI 课堂并准备第一步内容；之后会记录学习进度、练习结果和复习内容。`
    : settingsActionTitle
  const resetActionTitle = t`打开重新开始确认框；确认前不会删除本机保存的 AI 课堂进度、复习内容或练习记录。`
  const keepRecordTitle = t`关闭确认框并保留上次课堂记录。`
  const confirmResetTitle = t`确认删除本机保存的 AI 课堂进度、复习内容和练习记录；静态教程不会受影响。`
  const previewActionTitle = t`打开预览视图，只查看已验证课程内容；不会启动 AI 生成、聊天或记录学习进度。`
  const hasFocusedTopic = Boolean(topicTitle) && !topicUnavailable

  const primaryAction = () => {
    if (canEnter) {
      onEnter()
      return
    }
    openSettings(true)
  }

  useEffect(() => {
    if (resetConfirming)
      keepRecordButtonRef.current?.focus()
  }, [resetConfirming])

  const cancelReset = () => {
    setResetConfirming(false)
    resetButtonRef.current?.focus()
  }

  const confirmReset = () => {
    setResetConfirming(false)
    onResetSession?.()
  }

  const handleResetConfirmationKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape')
      return
    event.preventDefault()
    cancelReset()
  }

  return (
    <div
      data-testid="classroom-landing-page"
      className="ai-classroom-viewport-root flex flex-col bg-tour-bg text-tour-text"
    >
      <header
        data-testid="classroom-landing-header"
        className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-tour-border bg-tour-surface px-3 py-2 sm:h-12 sm:flex-nowrap sm:px-5 sm:py-0"
      >
        <ClassroomBrandChip />
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 overflow-x-auto overscroll-x-contain sm:flex-none sm:overflow-visible">
          {sourceHref && (
            <a
              href={sourceHref}
              title={sourceActionTitle}
              className="inline-flex shrink-0 items-center gap-2 rounded-md border border-tour-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-tour-bg"
            >
              <BookOpenCheck aria-hidden="true" className="size-4" />
              <Trans>查看对应教程</Trans>
            </a>
          )}
          {(!configReady || sharedQuotaExhausted) && (
            <button
              type="button"
              aria-describedby={sessionServiceRecoveryDescriptionId ?? blockedActionDescriptionId}
              title={settingsActionTitle}
              onClick={() => openSettings(true)}
              className="inline-flex shrink-0 items-center gap-2 rounded-md border border-tour-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-tour-bg"
            >
              <Settings2 aria-hidden="true" className="size-4" />
              {sharedQuotaExhausted ? <Trans>使用自己的 API Key</Trans> : <Trans>配置 AI 服务</Trans>}
            </button>
          )}
        </div>
      </header>
      <ClassroomPersistenceBanner issue={persistenceIssue} saveIssue={saveIssue} onRetrySave={onRetrySave} />

      <main className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="flex min-w-0 items-center px-6 py-10 lg:min-h-0 lg:px-14">
          <div className="min-w-0 max-w-3xl">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-tour-border bg-tour-surface px-3 py-1 text-xs font-medium text-tour-link">
              <Sparkles aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="min-w-0 break-words">{topicTitle ?? <Trans>AI 课堂</Trans>}</span>
            </div>
            <h1 className="mt-5 break-words text-4xl font-bold tracking-normal text-tour-heading md:text-5xl">
              {hasFocusedTopic
                ? <Trans>从当前主题开始学习</Trans>
                : <Trans>从已验证课程开始学习</Trans>}
            </h1>
            {topicUnavailable && (
              <div className="mt-4 flex min-w-0 max-w-2xl items-start gap-2 rounded-md border border-classroom-warning-border bg-classroom-warning-bg px-3 py-2 text-sm leading-7 text-classroom-warning-fg">
                <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span className="min-w-0 break-words"><Trans>链接里的主题不在已验证 AI 课堂内容中，已忽略该主题。</Trans></span>
              </div>
            )}
            <p className="mt-5 max-w-2xl break-words text-base leading-8 text-muted-foreground">
              <Trans>
                AI 课堂会使用已验证的教程内容组织讲解、练习和答疑。需要时，你也可以回到原教程继续阅读。
              </Trans>
            </p>

            {hasClassroomSession && aiServiceNeedsRecovery && (
              <div
                id={sessionServiceIssueId}
                className="mt-5 flex min-w-0 max-w-2xl items-start gap-2 rounded-md border border-classroom-warning-border bg-classroom-warning-bg px-3 py-2 text-sm leading-7 text-classroom-warning-fg"
              >
                <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <div className="min-w-0">
                  <p className="break-words font-semibold">
                    {sharedQuotaExhausted
                      ? <Trans>共享额度已用完，已保存的课堂仍可查看。</Trans>
                      : <Trans>AI 服务配置未完成，已保存的课堂仍可查看。</Trans>}
                  </p>
                  <p className="mt-1 break-words text-xs leading-6">
                    {sharedQuotaExhausted
                      ? quotaResetMoment
                        ? (
                            <Trans>
                              继续上次课堂可回看已有内容；聊天、生成下一步和复习检查需要等待额度刷新（
                              {quotaResetMoment}
                              ），或使用自己的 API Key。
                            </Trans>
                          )
                        : <Trans>继续上次课堂可回看已有内容；聊天、生成下一步和复习检查需要等待额度刷新，或使用自己的 API Key。</Trans>
                      : <Trans>继续上次课堂可回看已有内容；聊天、生成下一步和复习检查需要先配置可用服务。</Trans>}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-8 flex min-w-0 flex-wrap items-center gap-3">
              <button
                type="button"
                aria-describedby={sessionServiceRecoveryDescriptionId ?? blockedActionDescriptionId}
                title={primaryActionTitle}
                onClick={primaryAction}
                data-testid="classroom-landing-primary"
                className="inline-flex max-w-full items-center justify-center gap-2 rounded-md bg-classroom-success-fg px-5 py-2.5 text-left text-sm font-semibold text-white shadow-sm hover:brightness-95"
              >
                <span className="min-w-0 break-words">
                  {canEnter
                    ? hasClassroomSession ? <Trans>继续上次课堂</Trans> : <Trans>开始 AI 课堂</Trans>
                    : sharedQuotaExhausted ? <Trans>使用自己的 API Key</Trans> : <Trans>配置 AI 服务开始</Trans>}
                </span>
                <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
              </button>
              {!hasClassroomSession && !configReady && (
                <span id={configHintId} className="max-w-full break-words text-xs leading-6 text-muted-foreground">
                  <Trans>完成服务地址、API Key 和模型配置后即可开始。</Trans>
                </span>
              )}
              {!hasClassroomSession && configReady && sharedQuotaExhausted && (
                <span id={quotaHintId} className="max-w-sm text-xs leading-6 text-muted-foreground">
                  <Trans>今日共享额度已用完，暂时无法准备新的课堂内容。</Trans>
                  {' '}
                  {quotaResetMoment
                    ? (
                        <Trans>
                          下次刷新：
                          {quotaResetMoment}
                          ，刷新后会自动恢复；使用自己的 API Key 可立刻继续。
                        </Trans>
                      )
                    : <Trans>刷新后会自动恢复；使用自己的 API Key 可立刻继续。</Trans>}
                </span>
              )}
              {hasClassroomSession && onResetSession && (
                <button
                  ref={resetButtonRef}
                  type="button"
                  title={resetActionTitle}
                  onClick={() => setResetConfirming(true)}
                  data-testid="classroom-landing-reset"
                  className="inline-flex max-w-full items-center justify-center gap-2 rounded-md border border-tour-border bg-tour-surface px-4 py-2.5 text-left text-sm font-semibold text-muted-foreground hover:bg-tour-bg"
                >
                  <RotateCcw aria-hidden="true" className="size-4 shrink-0" />
                  <span className="min-w-0 break-words"><Trans>重新开始</Trans></span>
                </button>
              )}
            </div>
            {resetConfirming && (
              <section
                data-testid="classroom-reset-confirmation"
                role="group"
                aria-labelledby={resetConfirmTitleId}
                aria-describedby={resetConfirmDescriptionId}
                onKeyDown={handleResetConfirmationKeyDown}
                className="mt-4 max-w-xl break-words rounded-md border border-classroom-warning-border bg-classroom-warning-bg px-4 py-3 text-sm text-classroom-warning-fg"
              >
                <div id={resetConfirmTitleId} className="font-semibold"><Trans>清除上次课堂并重新开始？</Trans></div>
                <p id={resetConfirmDescriptionId} className="mt-1 text-xs leading-6">
                  <Trans>这会删除本机保存的 AI 课堂进度、复习内容和练习记录；静态教程不会受影响。</Trans>
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    ref={keepRecordButtonRef}
                    type="button"
                    aria-describedby={resetConfirmDescriptionId}
                    title={keepRecordTitle}
                    onClick={cancelReset}
                    className="inline-flex items-center justify-center rounded-md border border-classroom-warning-border bg-tour-surface px-3 py-1.5 text-xs font-semibold text-classroom-warning-fg"
                  >
                    <Trans>保留记录</Trans>
                  </button>
                  <button
                    type="button"
                    aria-describedby={resetConfirmDescriptionId}
                    title={confirmResetTitle}
                    onClick={confirmReset}
                    className="inline-flex items-center justify-center rounded-md bg-classroom-warning-fg px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    <Trans>确认重新开始</Trans>
                  </button>
                </div>
              </section>
            )}
            {!hasClassroomSession && onPreview && (
              <div className="mt-4 min-w-0 max-w-xl">
                <button
                  type="button"
                  aria-describedby={previewHintId}
                  title={previewActionTitle}
                  onClick={onPreview}
                  data-testid="classroom-landing-preview"
                  className="inline-flex max-w-full items-center justify-center gap-2 rounded-md border border-tour-border bg-tour-surface px-4 py-2 text-left text-sm font-semibold text-muted-foreground hover:bg-tour-bg"
                >
                  <BookOpenCheck aria-hidden="true" className="size-4 shrink-0" />
                  <span className="min-w-0 break-words"><Trans>先预览课程内容</Trans></span>
                </button>
                <p id={previewHintId} className="mt-2 break-words text-xs leading-6 text-muted-foreground">
                  <Trans>预览只展示已验证课程内容，不会启动 AI 生成、聊天或记录学习进度。</Trans>
                </p>
              </div>
            )}
          </div>
        </section>

        <aside className="min-w-0 border-t border-tour-border bg-tour-surface px-6 py-8 lg:border-l lg:border-t-0 lg:px-8">
          <div className="space-y-5">
            <section className="min-w-0 rounded-md border border-tour-border bg-tour-bg p-4">
              <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-tour-heading">
                <BookOpenCheck aria-hidden="true" className="size-4 shrink-0 text-classroom-success-fg" />
                <span className="min-w-0 break-words"><Trans>学习</Trans></span>
              </div>
              <p className="mt-2 break-words text-sm leading-7 text-muted-foreground">
                <Trans>阅读当前主题的讲解，并按进度继续后续内容。</Trans>
              </p>
            </section>
            <section className="min-w-0 rounded-md border border-tour-border bg-tour-bg p-4">
              <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-tour-heading">
                <Code2 aria-hidden="true" className="size-4 shrink-0 text-tour-accent-fg" />
                <span className="min-w-0 break-words"><Trans>练习</Trans></span>
              </div>
              <p className="mt-2 break-words text-sm leading-7 text-muted-foreground">
                <Trans>完成代码练习，查看运行结果，并在需要时获得提示。</Trans>
              </p>
            </section>
            <section className="min-w-0 rounded-md border border-tour-border bg-tour-bg p-4">
              <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-tour-heading">
                <GraduationCap aria-hidden="true" className="size-4 shrink-0 text-classroom-success-fg" />
                <span className="min-w-0 break-words"><Trans>进度</Trans></span>
              </div>
              <p className="mt-2 break-words text-sm leading-7 text-muted-foreground">
                <Trans>进度来自已看内容、练习提交和复习检查；聊天答疑不会直接判定掌握。</Trans>
              </p>
            </section>
            <section className="min-w-0 rounded-md border border-tour-border bg-tour-bg p-4">
              <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-tour-heading">
                <MessagesSquare aria-hidden="true" className="size-4 shrink-0 text-classroom-warning-fg" />
                <span className="min-w-0 break-words"><Trans>复习</Trans></span>
              </div>
              <p className="mt-2 break-words text-sm leading-7 text-muted-foreground">
                <Trans>保留有用的说明，之后可以回看重点内容。</Trans>
              </p>
            </section>
          </div>
        </aside>
      </main>
    </div>
  )
}
