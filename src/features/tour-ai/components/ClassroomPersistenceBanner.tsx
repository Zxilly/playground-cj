'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { CheckCircle2, CircleAlert, RefreshCw } from 'lucide-react'
import { t } from '@lingui/core/macro'
import type { ClassroomSessionHydrationIssue, ClassroomSessionSaveIssue } from '@/lib/ai/classroom/use-persistent-session'

interface ClassroomPersistenceBannerProps {
  issue: ClassroomSessionHydrationIssue | null
  saveIssue?: ClassroomSessionSaveIssue | null
  onRetrySave?: () => Promise<void> | void
}

export function ClassroomPersistenceBanner({ issue, saveIssue = null, onRetrySave }: ClassroomPersistenceBannerProps) {
  const titleId = useId()
  const detailId = useId()
  const riskId = useId()
  const [retryRequest, setRetryRequest] = useState<ClassroomSessionSaveIssue | null>(null)
  const [retryFailedIssue, setRetryFailedIssue] = useState<ClassroomSessionSaveIssue | null>(null)
  const [retryRecoveredIssue, setRetryRecoveredIssue] = useState<ClassroomSessionSaveIssue | null>(null)
  const saveIssueRef = useRef(saveIssue)
  saveIssueRef.current = saveIssue

  const isSaveIssue = saveIssue === 'failed'
  const isClearIssue = saveIssue === 'clear_failed'
  const hasSaveIssue = isSaveIssue || isClearIssue
  const recovered = !issue && !hasSaveIssue && retryRecoveredIssue != null
  const recoveredClearIssue = retryRecoveredIssue === 'clear_failed'
  const retrying = hasSaveIssue && retryRequest === saveIssue
  const retryFailed = hasSaveIssue && !retrying && retryFailedIssue === saveIssue
  useEffect(() => {
    if (!hasSaveIssue) {
      const recoveredIssue = retryRequest ?? retryFailedIssue
      if (recoveredIssue) {
        // eslint-disable-next-line react/set-state-in-effect -- Parent-owned persistence recovery should leave a brief confirmation before hiding.
        setRetryRecoveredIssue(recoveredIssue)
      }
      // eslint-disable-next-line react/set-state-in-effect -- External save outcomes must unlock a stale retry affordance.
      setRetryRequest(null)
      // eslint-disable-next-line react/set-state-in-effect -- External save outcomes must clear stale retry failure copy.
      setRetryFailedIssue(null)
      return
    }
    if (retryRecoveredIssue) {
      // eslint-disable-next-line react/set-state-in-effect -- A new save issue supersedes the previous recovery confirmation.
      setRetryRecoveredIssue(null)
    }
    if (retryRequest !== saveIssue) {
      // eslint-disable-next-line react/set-state-in-effect -- External save outcomes must unlock a stale retry affordance.
      setRetryRequest(null)
    }
    if (retryFailedIssue !== saveIssue) {
      // eslint-disable-next-line react/set-state-in-effect -- External save outcomes must clear stale retry failure copy.
      setRetryFailedIssue(null)
    }
  }, [hasSaveIssue, retryFailedIssue, retryRecoveredIssue, retryRequest, saveIssue])

  useEffect(() => {
    if (!retryRecoveredIssue)
      return
    const timer = window.setTimeout(() => {
      setRetryFailedIssue(null)
      setRetryRecoveredIssue(null)
    }, 3200)
    return () => window.clearTimeout(timer)
  }, [retryRecoveredIssue])

  if (!issue && !saveIssue && !retryRecoveredIssue)
    return null

  const titleText = recovered
    ? recoveredClearIssue
      ? t`当前课堂已保存。`
      : t`学习进度已保存。`
    : isClearIssue
      ? t`旧课堂记录暂时无法清除。`
      : isSaveIssue
        ? t`当前学习进度暂时无法保存。`
        : issue === 'timeout'
          ? t`学习记录加载时间过长，已先开启临时课堂。`
          : t`无法加载本地学习记录，已先开启临时课堂。`
  const detailText = recovered
    ? recoveredClearIssue
      ? t`当前新课堂已保存到本机；刷新后旧课堂记录不会再次覆盖当前页面。`
      : t`当前课堂内容、练习结果和复习笔记已保存到本机。`
    : isClearIssue
      ? t`当前页面已重置为新课堂，但本地旧记录可能仍在；刷新或关闭页面前，请重新尝试保存当前课堂。`
      : isSaveIssue
        ? t`你可以继续学习；刷新或关闭页面前，请先重新尝试保存。`
        : t`你可以继续学习；如果想恢复上次记录，请刷新后重试。`
  const riskDetailText = recovered
    ? t`可以继续学习；下次打开时会优先恢复这次课堂。`
    : isClearIssue
      ? t`如果现在刷新，旧课堂记录可能再次出现；当前新课堂的内容、练习结果和复习笔记也可能还没保存。`
      : isSaveIssue
        ? t`本次课堂内容、练习结果和复习笔记可能不会出现在下次打开时；代码草稿仍会尽量保留在本机。`
        : t`临时课堂会在你继续学习后覆盖当前页面状态；如果需要找回旧记录，请先重新加载记录。`
  const retryFailureDetailText = isClearIssue
    ? t`这次保存当前课堂仍未成功。本地旧记录可能还在；请再试一次。`
    : t`这次重试仍未保存成功。你可以继续学习；刷新或关闭页面前，请再试一次。`
  const activeDetailText = retrying
    ? t`正在保存当前课堂；完成前请保持页面打开。`
    : retryFailed
      ? retryFailureDetailText
      : detailText
  const actionLabelText = retrying
    ? t`正在保存...`
    : isClearIssue
      ? t`保存当前课堂`
      : isSaveIssue
        ? t`重新尝试保存`
        : t`重新加载记录`
  const actionInstructionText = retrying
    ? t`正在保存，完成前不会重复提交。`
    : hasSaveIssue && !onRetrySave
      ? t`当前没有可用的保存重试动作，请保持页面打开后稍后再试。`
      : isClearIssue
        ? t`点击会保存当前新课堂，降低刷新后旧记录回来的风险。`
        : isSaveIssue
          ? t`点击会重新尝试保存当前课堂；不会清除已生成内容、练习结果或复习笔记。`
          : t`点击会重新加载页面，尝试读取上次学习记录。`
  const actionTitle = [activeDetailText, riskDetailText, actionInstructionText].join(' ')
  const retrySave = () => {
    if (!hasSaveIssue) {
      window.location.reload()
      return
    }
    if (!onRetrySave || retrying)
      return

    const requestIssue = saveIssue
    setRetryFailedIssue(null)
    setRetryRecoveredIssue(null)
    setRetryRequest(requestIssue)
    const settleRetryRequest = (failed: boolean) => {
      window.setTimeout(() => {
        setRetryRequest((current) => {
          if (current !== requestIssue)
            return current
          if (failed || saveIssueRef.current === requestIssue) {
            setRetryFailedIssue(currentFailed => currentFailed ?? requestIssue)
            return null
          }
          return current
        })
      }, 0)
    }
    try {
      void Promise.resolve(onRetrySave())
        .then(
          () => settleRetryRequest(false),
          () => settleRetryRequest(true),
        )
    }
    catch {
      settleRetryRequest(true)
    }
  }

  const toneClassName = recovered
    ? 'border-b border-classroom-success-border bg-classroom-success-bg px-3 py-2 text-xs text-classroom-success-fg sm:items-center sm:px-5'
    : 'border-b border-classroom-warning-border bg-classroom-warning-bg px-3 py-2 text-xs text-classroom-warning-fg sm:items-center sm:px-5'
  const Icon = recovered ? CheckCircle2 : CircleAlert

  return (
    <div
      data-testid="classroom-persistence-banner"
      role="region"
      aria-labelledby={titleId}
      aria-describedby={`${detailId} ${riskId}`}
      aria-busy={retrying || undefined}
      className={`flex min-w-0 flex-wrap items-start gap-3 ${toneClassName}`}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="min-w-0 flex-1 leading-relaxed"
      >
        <div id={titleId} className="break-words font-semibold">
          {titleText}
        </div>
        <div id={detailId} className="break-words opacity-80">
          {activeDetailText}
        </div>
        <div id={riskId} data-testid="classroom-persistence-risk" className="mt-1 break-words opacity-80">
          {riskDetailText}
        </div>
      </div>
      {!recovered && (
        <button
          type="button"
          aria-describedby={`${detailId} ${riskId}`}
          title={actionTitle}
          onClick={retrySave}
          disabled={retrying || (hasSaveIssue && !onRetrySave)}
          className="inline-flex w-full max-w-full items-center justify-center gap-1.5 rounded-md border border-classroom-warning-border bg-tour-surface px-3 py-1 text-left text-xs font-semibold hover:bg-classroom-warning-bg disabled:opacity-50 sm:w-auto"
        >
          <RefreshCw aria-hidden="true" className={retrying ? 'size-3.5 shrink-0 animate-spin' : 'size-3.5 shrink-0'} />
          <span className="min-w-0 break-words">{actionLabelText}</span>
        </button>
      )}
    </div>
  )
}
