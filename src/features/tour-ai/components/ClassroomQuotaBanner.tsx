'use client'

import { useEffect, useId, useReducer } from 'react'
import { CircleAlert, KeyRound } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { useLLMConfigStore } from '@/stores/llmConfig'
import { formatResetMoment } from '@/modules/llm-config/runtime/format-reset-moment'

// Persistent strip shown across the top of the classroom whenever the shared
// auto-quota is exhausted. The pre-existing QuotaExhaustedDialog interrupts
// once and then dismisses, leaving the learner with no surface explaining why
// new lessons stopped flowing. This banner stays put — exercises are still
// locally gradable and past lessons remain readable, so the experience does
// not need to be "all or nothing".
export function ClassroomQuotaBanner() {
  const keySource = useLLMConfigStore(s => s.keySource)
  const autoQuota = useLLMConfigStore(s => s.autoQuota)
  const openSettings = useLLMConfigStore(s => s.setSettingsDialogOpen)
  const [, forceTick] = useReducer((n: number) => n + 1, 0)
  const titleId = useId()
  const detailId = useId()

  const visible = keySource === 'auto' && !!autoQuota?.exhausted

  // Tick once a minute so the reset moment text stays approximately current.
  // No tick when invisible — the effect is short-circuited.
  useEffect(() => {
    if (!visible)
      return
    const id = window.setInterval(forceTick, 60_000)
    return () => window.clearInterval(id)
  }, [visible])

  if (!visible || !autoQuota)
    return null

  const refreshMoment = formatResetMoment(autoQuota.nextResetAt)
  const actionTitle = t`打开 AI 服务设置，改用自己的 API Key 后可立刻继续；不会排队新的 AI 请求。共享额度下次刷新：${refreshMoment}。`

  return (
    <div
      data-testid="classroom-quota-banner"
      role="region"
      aria-labelledby={titleId}
      aria-describedby={detailId}
      className="flex min-w-0 flex-wrap items-start gap-3 border-b border-classroom-warning-border bg-classroom-warning-bg px-3 py-2 text-xs text-classroom-warning-fg sm:items-center sm:px-5"
    >
      <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="min-w-0 flex-1 leading-relaxed"
      >
        <div id={titleId} className="break-words font-semibold">
          <Trans>今日共享额度已用完，暂时无法准备新的课堂内容。</Trans>
        </div>
        <div id={detailId} className="break-words opacity-80">
          <Trans>
            你仍可以复习已有内容、做练习题，并查看测试结果。下次刷新：
            {refreshMoment}
            ，刷新后课堂会自动继续准备新的 AI 内容；使用自己的 API Key 可立刻继续。
          </Trans>
        </div>
      </div>
      <button
        type="button"
        aria-describedby={detailId}
        title={actionTitle}
        onClick={() => openSettings(true)}
        className="inline-flex w-full max-w-full items-center justify-center gap-1.5 rounded-md border border-classroom-warning-border bg-tour-surface px-3 py-1 text-left text-xs font-semibold text-classroom-warning-fg hover:bg-classroom-warning-bg sm:w-auto"
      >
        <KeyRound aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="min-w-0 break-words"><Trans>使用自己的 API Key</Trans></span>
      </button>
    </div>
  )
}
