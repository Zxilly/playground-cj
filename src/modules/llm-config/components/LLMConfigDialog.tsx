'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { CalendarClock, CircleAlert, KeyRound, Loader2, RotateCw, Settings, ShieldCheck, Wallet } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { DEFAULT_LLM_CONFIG, useLLMConfigStore } from '@/stores/llmConfig'
import { providerLabel, switchProviderPreservingKey } from '@/lib/ai/model-provider'
import type { LLMConfig, LLMProvider } from '@/lib/ai/model-provider'
import { formatResetMoment } from '@/modules/llm-config/runtime/format-reset-moment'
import { fetchTokenUsage } from '@/modules/llm-config/runtime/new-api-client'

type ConfigMode = 'shared' | 'custom'

interface UsageState {
  apiKey?: string
  totalGranted: number
  totalUsed: number
  totalAvailable: number
  loading: boolean
  error?: string
}

const QUOTA_PER_USD = 500_000

async function fetchUsage(apiKey: string): Promise<UsageState> {
  const result = await fetchTokenUsage(apiKey)
  if (!result.ok)
    return { totalGranted: 0, totalUsed: 0, totalAvailable: 0, loading: false, error: result.error }
  return { ...result.usage, loading: false }
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
}

function createEditableDraft(config: Readonly<LLMConfig>, keySource: 'auto' | 'user'): LLMConfig {
  if (keySource === 'auto')
    return { ...DEFAULT_LLM_CONFIG }
  return { ...config }
}

export function LLMConfigDialog({ withTrigger = true }: LLMConfigDialogProps = {}) {
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
  const providerGroupLabelId = useId()
  const resetDraftHelpId = useId()
  const userConfigValidationId = useId()

  const handleOpenChange = useCallback((next: boolean) => {
    if (next) {
      setDraft(createEditableDraft(config, keySource))
      setMode(keySource === 'user' ? 'custom' : 'shared')
    }
    setOpen(next)
  }, [config, keySource, setOpen])

  const usingAuto = keySource === 'auto'
  const usingShared = mode === 'shared'
  const missingUserEndpoint = mode === 'custom' && draft.baseURL.trim().length === 0
  const missingUserModel = mode === 'custom' && draft.model.trim().length === 0
  const userConfigIncomplete = missingUserEndpoint || missingUserModel
  const usageApiKey = usingShared && usingAuto ? config.apiKey : ''
  const showUsage = open && usageApiKey.length > 0

  useEffect(() => {
    if (!showUsage)
      return
    let cancelled = false
    void fetchUsage(usageApiKey).then((u) => {
      if (!cancelled)
        setUsage({ ...u, apiKey: usageApiKey })
    })
    return () => {
      cancelled = true
    }
  }, [showUsage, usageApiKey])

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
  const handleProviderChange = (provider: LLMProvider) => {
    setDraft(switchProviderPreservingKey(draft, provider))
  }

  const visibleUsage: UsageState = usage.apiKey === usageApiKey
    ? usage
    : { totalGranted: 0, totalUsed: 0, totalAvailable: 0, loading: true }
  const usageReady = !visibleUsage.loading && !visibleUsage.error
  const available = visibleUsage.totalAvailable
  // Prefer the per-period (daily) budget so the meter shows *today's* usage, not
  // the token's cumulative lifetime total (total_granted/total_used keep climbing
  // across daily resets, which made a fresh user look ~half spent). Fall back to
  // the cumulative figures only when the budget is unknown (older cached key).
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
      <DialogContent className="sm:max-w-[480px]">
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
        <div
          role="tablist"
          aria-label={t`AI 服务来源`}
          className="grid grid-cols-2 gap-1 rounded-md border border-border/60 bg-muted/40 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={usingShared}
            onClick={() => setMode('shared')}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-[5px] px-3 py-1.5 text-xs font-medium transition-colors',
              usingShared ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Wallet aria-hidden="true" className="size-3.5" />
            <Trans>共享额度</Trans>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!usingShared}
            onClick={() => setMode('custom')}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-[5px] px-3 py-1.5 text-xs font-medium transition-colors',
              !usingShared ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <ShieldCheck aria-hidden="true" className="size-3.5" />
            <Trans>自定义 API Key</Trans>
          </button>
        </div>
        <p id={modeHelpId} className="text-xs leading-relaxed text-muted-foreground">
          {usingShared
            ? keySource === 'user'
              ? <Trans>已切换为共享额度（草稿）；保存后替换当前 API Key，取消则保留原配置。</Trans>
              : <Trans>当前使用共享额度；如需自定义服务地址、API 风格与模型，请切换至“自定义 API Key”。</Trans>
            : <Trans>保存后使用自定义 API Key；如需恢复共享额度，请切换至“共享额度”。</Trans>}
        </p>

        <div className="grid gap-3 py-1">
          {usingShared
            ? (
                <>
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
                </>
              )
            : (
                <>
                  <div className="grid gap-1.5">
                    <Label htmlFor="llm-api-key" className="flex items-center gap-1 text-xs font-medium">
                      <KeyRound aria-hidden="true" className="size-3" />
                      <Trans>API Key</Trans>
                    </Label>
                    <Input
                      id="llm-api-key"
                      type="password"
                      autoComplete="off"
                      value={draft.apiKey}
                      aria-describedby={modeHelpId}
                      onChange={e => setDraft({ ...draft, apiKey: e.target.value })}
                      placeholder={t`留空使用共享额度`}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <div id={providerGroupLabelId} className="text-xs font-medium"><Trans>API 风格</Trans></div>
                    <div
                      role="group"
                      aria-labelledby={providerGroupLabelId}
                      className="grid grid-cols-2 gap-2"
                    >
                      {(['openai-compatible', 'anthropic'] satisfies LLMProvider[]).map(provider => (
                        <Button
                          key={provider}
                          type="button"
                          variant={draft.provider === provider ? 'default' : 'outline'}
                          size="sm"
                          aria-pressed={draft.provider === provider}
                          onClick={() => handleProviderChange(provider)}
                          className="cursor-pointer"
                        >
                          {providerLabel(provider)}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="llm-base-url" className="text-xs font-medium"><Trans>服务地址</Trans></Label>
                    <Input
                      id="llm-base-url"
                      value={draft.baseURL}
                      aria-invalid={missingUserEndpoint || undefined}
                      aria-describedby={missingUserEndpoint ? userConfigValidationId : undefined}
                      onChange={e => setDraft({ ...draft, baseURL: e.target.value })}
                      placeholder="https://..."
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="llm-model" className="text-xs font-medium"><Trans>模型</Trans></Label>
                    <Input
                      id="llm-model"
                      value={draft.model}
                      aria-invalid={missingUserModel || undefined}
                      aria-describedby={missingUserModel ? userConfigValidationId : undefined}
                      onChange={e => setDraft({ ...draft, model: e.target.value })}
                      placeholder="model"
                      className="font-mono text-xs"
                    />
                  </div>

                  {userConfigIncomplete && (
                    <p id={userConfigValidationId} role="alert" className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                      <CircleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                      <span><Trans>使用自定义 API Key 时，需同时配置服务地址与模型。</Trans></span>
                    </p>
                  )}
                </>
              )}
        </div>
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
