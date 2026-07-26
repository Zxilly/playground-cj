'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { CalendarClock, CircleAlert, Loader2, RotateCw, Settings, ShieldCheck, Wallet } from 'lucide-react'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DEFAULT_LLM_CONFIG, useLLMConfigStore } from '@/stores/llmConfig'
import type { LLMConfig } from '@/lib/ai/model-provider'
import { isUserConfigIncomplete, resolveProviderDefaults } from '@/lib/ai/model-provider'
import { LLMConfigFields } from '@/modules/llm-config/components/LLMConfigFields'
import { formatResetMoment } from '@/modules/llm-config/runtime/format-reset-moment'
import { fetchSharedGatewayMetadata } from '@/modules/llm-config/runtime/shared-gateway-client'

type ConfigMode = 'shared' | 'custom'

interface UsageState {
  totalGranted: number
  totalUsed: number
  totalAvailable: number
  loading: boolean
  error?: string
}

const QUOTA_PER_USD = 500_000

async function fetchUsage(): Promise<UsageState> {
  try {
    const { quota } = await fetchSharedGatewayMetadata()
    return {
      totalGranted: quota.perPeriod,
      totalUsed: Math.max(0, quota.perPeriod - quota.available),
      totalAvailable: quota.available,
      loading: false,
    }
  }
  catch (error) {
    return {
      totalGranted: 0,
      totalUsed: 0,
      totalAvailable: 0,
      loading: false,
      error: error instanceof Error ? error.message : 'unknown error',
    }
  }
}

function quotaToUSD(q: number): string {
  return `$${(q / QUOTA_PER_USD).toFixed(4)}`
}

interface LLMConfigDialogProps {
  /**
   * When false, omit the built-in gear-icon trigger and let an external caller
   * open the dialog via `useLLMConfigStore.setSettingsDialogOpen`. Useful when
   * mounting the dialog inside a host that already provides its own trigger,
   * or with surface colors the white-on-teal default trigger does not match.
   */
  withTrigger?: boolean
  /** External trigger to restore focus to when `withTrigger` is false. */
  returnFocusRef?: RefObject<HTMLElement | null>
}

function createEditableDraft(config: Readonly<LLMConfig>, keySource: 'auto' | 'user'): LLMConfig {
  if (keySource === 'auto')
    return { ...DEFAULT_LLM_CONFIG }
  return { ...config }
}

export function LLMConfigDialog({ returnFocusRef, withTrigger = true }: LLMConfigDialogProps = {}) {
  const config = useLLMConfigStore(state => state.config)
  const setConfig = useLLMConfigStore(state => state.setConfig)
  const setSharedConfig = useLLMConfigStore(state => state.setSharedConfig)
  const keySource = useLLMConfigStore(state => state.keySource)
  const autoQuota = useLLMConfigStore(state => state.autoQuota)
  const open = useLLMConfigStore(state => state.settingsDialogOpen)
  const setOpen = useLLMConfigStore(state => state.setSettingsDialogOpen)
  const [draft, setDraft] = useState(() => createEditableDraft(config, keySource))
  // The source toggle is explicit (a tab) rather than inferred from a blank API
  // key, so the learner always knows which mode they are saving.
  const [mode, setMode] = useState<ConfigMode>(() => (keySource === 'user' ? 'custom' : 'shared'))
  const [usage, setUsage] = useState<UsageState>({ totalGranted: 0, totalUsed: 0, totalAvailable: 0, loading: true })
  const modeHelpId = useId()
  const resetDraftHelpId = useId()
  const userConfigValidationId = useId()
  const wasOpenRef = useRef(false)

  const handleOpenChange = useCallback((next: boolean) => {
    if (next) {
      setDraft(createEditableDraft(config, keySource))
      setMode(keySource === 'user' ? 'custom' : 'shared')
    }
    setOpen(next)
  }, [config, keySource, setOpen])

  // Hosts with `withTrigger={false}` open the controlled dialog through the
  // store, so Radix never calls `handleOpenChange(true)`. Recreate the draft on
  // every closed -> open transition as well; otherwise Cancel closes the modal
  // but the next open misleadingly restores the abandoned tab and field edits.
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      // eslint-disable-next-line react/set-state-in-effect -- reset the controlled modal draft only on a closed -> open transition
      setDraft(createEditableDraft(config, keySource))
      // eslint-disable-next-line react/set-state-in-effect -- keep the source tab aligned with the persisted config on external reopen
      setMode(keySource === 'user' ? 'custom' : 'shared')
    }
    wasOpenRef.current = open
  }, [config, keySource, open])

  const usingAuto = keySource === 'auto'
  const usingShared = mode === 'shared'
  const userConfigIncomplete = mode === 'custom' && isUserConfigIncomplete(draft)
  const showUsage = open && usingShared && usingAuto

  useEffect(() => {
    if (!showUsage)
      return
    let cancelled = false
    // eslint-disable-next-line react/set-state-in-effect -- every dialog open starts a distinct metadata request
    setUsage({ totalGranted: 0, totalUsed: 0, totalAvailable: 0, loading: true })
    void fetchUsage().then((u) => {
      if (!cancelled)
        setUsage(u)
    })
    return () => {
      cancelled = true
    }
  }, [showUsage])

  const handleSave = () => {
    if (usingShared) {
      setSharedConfig()
      setOpen(false)
      return
    }
    if (userConfigIncomplete)
      return
    // Custom tab with an empty key still falls back to shared quota rather than
    // saving an unusable keyless "user" config.
    if (draft.apiKey.trim())
      setConfig(draft)
    else
      setSharedConfig()
    setOpen(false)
  }

  const handleReset = () => {
    setMode('shared')
    setDraft(createEditableDraft(DEFAULT_LLM_CONFIG, 'auto'))
  }

  const visibleUsage = usage
  const usageReady = !visibleUsage.loading && !visibleUsage.error
  const available = visibleUsage.totalAvailable
  // Prefer the bootstrap snapshot when present. The direct metadata request uses
  // the same per-period total, so the fallback has identical semantics.
  const dailyBudget = autoQuota?.perPeriod
  const hasDailyBudget = typeof dailyBudget === 'number' && dailyBudget > 0
  const meterTotal = hasDailyBudget ? dailyBudget : visibleUsage.totalGranted
  const usedAmount = hasDailyBudget ? Math.max(0, dailyBudget - available) : visibleUsage.totalUsed
  const lowBudget = usageReady && available > 0 && available < QUOTA_PER_USD * 0.01
  const exhausted = usageReady && available <= 0 && meterTotal > 0
  const usagePct = meterTotal > 0 ? Math.min(100, Math.round((usedAmount / meterTotal) * 100)) : 0

  const showResetSchedule = usingAuto && autoQuota?.nextResetAt
  const resetMoment = autoQuota ? formatResetMoment(autoQuota.nextResetAt) : ''

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {withTrigger && (
        <DialogTrigger asChild>
          <button
            aria-label={t`AI 服务设置`}
            title={t`AI 服务设置`}
            className="inline-flex size-7 cursor-pointer items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-200/60"
          >
            <Settings aria-hidden="true" className="size-3.5" />
          </button>
        </DialogTrigger>
      )}
      <DialogContent
        className="teach-workspace-theme sm:max-w-[480px]"
        onCloseAutoFocus={(event) => {
          if (!returnFocusRef?.current)
            return
          event.preventDefault()
          returnFocusRef.current.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings aria-hidden="true" className="size-4 text-primary" />
            <Trans>AI 服务设置</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>未配置 API Key 时使用共享额度；共享额度有限，可能耗尽。</Trans>
          </DialogDescription>
        </DialogHeader>

        {/* Explicit source toggle: shared quota vs. a personal key. */}
        <Tabs
          value={mode}
          onValueChange={(value) => {
            const nextMode = value as ConfigMode
            if (nextMode === 'custom' && draft.transport === 'shared-gateway')
              setDraft(resolveProviderDefaults('openai-compatible'))
            setMode(nextMode)
          }}
        >
          <TabsList aria-label={t`AI 服务来源`} className="grid w-full grid-cols-2">
            <TabsTrigger value="shared">
              <Wallet aria-hidden="true" className="size-3.5" />
              <Trans>共享额度</Trans>
            </TabsTrigger>
            <TabsTrigger value="custom">
              <ShieldCheck aria-hidden="true" className="size-3.5" />
              <Trans>自定义 API Key</Trans>
            </TabsTrigger>
          </TabsList>
          <p id={modeHelpId} className="text-xs leading-relaxed text-muted-foreground">
            {usingShared
              ? keySource === 'user'
                ? <Trans>已切换为共享额度（草稿）；保存后替换当前 API Key，取消则保留原配置。</Trans>
                : <Trans>当前使用共享额度；如需自定义服务地址、API 风格与模型，请切换至“自定义 API Key”。</Trans>
              : <Trans>保存后使用自定义 API Key；如需恢复共享额度，请切换至“共享额度”。</Trans>}
          </p>

          <TabsContent value="shared" className="grid gap-3">
            {showUsage && (
              <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${exhausted || lowBudget ? 'border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300' : 'border-border/60 bg-muted/30 text-muted-foreground'}`}
              >
                {visibleUsage.loading
                  ? <Loader2 aria-hidden="true" className="size-3.5 mt-0.5 shrink-0 animate-spin text-muted-foreground" />
                  : visibleUsage.error
                    ? <CircleAlert aria-hidden="true" className="size-3.5 mt-0.5 shrink-0 text-amber-500" />
                    : <Wallet aria-hidden="true" className={`size-3.5 mt-0.5 shrink-0 ${exhausted || lowBudget ? 'text-amber-500' : 'text-primary'}`} />}
                <div className="flex-1 leading-relaxed">
                  {visibleUsage.loading
                    ? <Trans>正在加载剩余额度…</Trans>
                    : visibleUsage.error
                      ? (
                          <span>
                            <Trans>无法读取剩余额度，请稍后重试。</Trans>
                          </span>
                        )
                      : (
                          <div className="space-y-1">
                            <div className="flex items-baseline gap-1.5">
                              <span><Trans>今日剩余</Trans></span>
                              <span className="font-mono text-sm font-semibold text-foreground">
                                {quotaToUSD(available)}
                              </span>
                              <span className="opacity-70">
                                {' / '}
                                {quotaToUSD(meterTotal)}
                              </span>
                            </div>
                            <div
                              role="progressbar"
                              aria-label={t`共享额度已使用量`}
                              aria-valuemin={0}
                              aria-valuemax={meterTotal}
                              aria-valuenow={usedAmount}
                              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                            >
                              <div
                                className={`h-full rounded-full transition-all ${exhausted ? 'bg-amber-500' : 'bg-primary'}`}
                                style={{ width: `${usagePct}%` }}
                              />
                            </div>
                          </div>
                        )}
                </div>
              </div>
            )}

            {showResetSchedule && (
              <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
                <CalendarClock aria-hidden="true" className="size-3.5 shrink-0 text-primary" />
                <span>
                  <Trans>下次刷新：</Trans>
                  <span className="ml-1 font-mono text-foreground">{resetMoment}</span>
                  <span className="ml-1 opacity-70"><Trans>（北京时间）</Trans></span>
                </span>
              </div>
            )}
          </TabsContent>

          <TabsContent value="custom" className="grid gap-3">
            <LLMConfigFields
              value={draft}
              onChange={setDraft}
              apiKeyDescribedBy={modeHelpId}
              apiKeyPlaceholder={t`留空使用共享额度`}
              validationId={userConfigValidationId}
            />
          </TabsContent>
        </Tabs>
        <p id={resetDraftHelpId} className="sr-only">
          <Trans>仅重置当前表单；保存后生效，取消则保留原配置。</Trans>
        </p>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" size="sm" aria-describedby={resetDraftHelpId} onClick={handleReset} className="cursor-pointer">
            <RotateCw aria-hidden="true" className="size-3.5 mr-1" />
            <Trans>重置默认</Trans>
          </Button>
          <div className="flex gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm" className="cursor-pointer"><Trans>取消</Trans></Button>
            </DialogClose>
            <Button
              type="button"
              size="sm"
              disabled={userConfigIncomplete}
              aria-describedby={userConfigIncomplete ? userConfigValidationId : undefined}
              onClick={handleSave}
              className="cursor-pointer disabled:cursor-not-allowed"
            >
              <Trans>保存</Trans>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
