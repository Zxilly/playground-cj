'use client'

import { useEffect, useReducer, useState } from 'react'
import { Sparkles, Wallet } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import { t } from '@lingui/core/macro'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useLLMConfigStore } from '@/stores/llmConfig'
import { formatResetMoment } from '@/modules/llm-config/runtime/format-reset-moment'

function formatCountdown(deltaMs: number): { hours: number, minutes: number } {
  const totalMinutes = Math.max(0, Math.floor(deltaMs / 60000))
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  }
}

export function QuotaExhaustedDialog() {
  const keySource = useLLMConfigStore(s => s.keySource)
  const autoQuota = useLLMConfigStore(s => s.autoQuota)
  const setSettingsDialogOpen = useLLMConfigStore(s => s.setSettingsDialogOpen)
  const settingsOpen = useLLMConfigStore(s => s.settingsDialogOpen)
  const [dismissedFor, setDismissedFor] = useState<number | null>(null)
  const [, forceTick] = useReducer((n: number) => n + 1, 0)

  const shouldShow = keySource === 'auto'
    && !!autoQuota?.exhausted
    && !settingsOpen
    && dismissedFor !== autoQuota.nextResetAt

  useEffect(() => {
    if (!shouldShow)
      return
    const id = window.setInterval(forceTick, 60_000)
    return () => window.clearInterval(id)
  }, [shouldShow])

  if (!autoQuota)
    return null

  const handleOpenChange = (next: boolean) => {
    if (!next)
      setDismissedFor(autoQuota.nextResetAt)
  }

  const handleGotoSettings = () => {
    setDismissedFor(autoQuota.nextResetAt)
    setSettingsDialogOpen(true)
  }

  const remainMs = autoQuota.nextResetAt - Date.now()
  const { hours, minutes } = formatCountdown(remainMs)
  const refreshMoment = formatResetMoment(autoQuota.nextResetAt)

  return (
    <Dialog open={shouldShow} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="size-4 text-amber-500" />
            <Trans>今日 AI 额度已用完</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>共享额度每日 0 点（北京时间）自动刷新。</Trans>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2 text-sm">
          <div className="flex items-baseline gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-amber-700 dark:text-amber-300">
            <Sparkles className="size-3.5 self-center shrink-0" />
            <div className="leading-relaxed">
              <div className="font-mono text-xs">{refreshMoment}</div>
              <div className="text-[11px] opacity-80">
                {remainMs > 0
                  ? t`约 ${hours} 小时 ${minutes} 分钟后刷新`
                  : t`即将刷新…`}
              </div>
            </div>
          </div>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            <Trans>如需立刻继续使用，可在 LLM 设置中填写你自己的 API Key。</Trans>
          </p>
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <DialogClose asChild>
            <Button type="button" variant="outline" size="sm" className="cursor-pointer">
              <Trans>我知道了</Trans>
            </Button>
          </DialogClose>
          <Button type="button" size="sm" onClick={handleGotoSettings} className="cursor-pointer">
            <Trans>使用自带 Key</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
