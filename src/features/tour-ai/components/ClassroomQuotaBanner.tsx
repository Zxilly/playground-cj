'use client'

import { useEffect, useReducer } from 'react'
import { CircleAlert, KeyRound } from 'lucide-react'
import { motion } from 'framer-motion'
import { Trans } from '@lingui/react/macro'
import { useLLMConfigStore } from '@/stores/llmConfig'
import { formatResetMoment } from '@/modules/llm-config/runtime/format-reset-moment'
import { classroomCardVariants } from '@/features/tour-ai/components/classroom-motion'

// Persistent strip shown across the top of the classroom whenever the shared
// auto-quota is exhausted. The pre-existing QuotaExhaustedDialog interrupts
// once and then dismisses, leaving the learner with no surface explaining why
// new lessons stopped flowing. This banner stays put — quizzes are still
// locally gradable and past lessons remain readable, so the experience does
// not need to be "all or nothing".
export function ClassroomQuotaBanner() {
  const keySource = useLLMConfigStore(s => s.keySource)
  const autoQuota = useLLMConfigStore(s => s.autoQuota)
  const openSettings = useLLMConfigStore(s => s.setSettingsDialogOpen)
  const [, forceTick] = useReducer((n: number) => n + 1, 0)

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

  return (
    <motion.div
      data-testid="classroom-quota-banner"
      variants={classroomCardVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-wrap items-center gap-3 border-b border-amber-500/30 bg-amber-500/10 px-5 py-2 text-xs text-amber-700 dark:text-amber-300"
    >
      <CircleAlert className="size-4 shrink-0" />
      <div className="flex-1 leading-relaxed">
        <div className="font-semibold">
          <Trans>今日共享额度已用完，新课程暂停生成。</Trans>
        </div>
        <div className="opacity-80">
          <Trans>
            你仍可以复习已生成的课程内容、做练习题，并查看测试结果。下次刷新：
            {refreshMoment}
          </Trans>
        </div>
      </div>
      <button
        type="button"
        onClick={() => openSettings(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-tour-surface px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"
      >
        <KeyRound className="size-3.5" />
        <Trans>使用自带 Key</Trans>
      </button>
    </motion.div>
  )
}
