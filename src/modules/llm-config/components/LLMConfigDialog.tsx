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
import { DEFAULT_LLM_CONFIG, useLLMConfigStore } from '@/stores/llmConfig'
import { providerLabel, switchProviderPreservingKey } from '@/lib/ai/model-provider'
import type { LLMConfig, LLMProvider } from '@/lib/ai/model-provider'
import { formatResetMoment } from '@/modules/llm-config/runtime/format-reset-moment'
import { fetchTokenUsage } from '@/modules/llm-config/runtime/new-api-client'

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
  const [usage, setUsage] = useState<UsageState>({ totalGranted: 0, totalUsed: 0, totalAvailable: 0, loading: true })
  const modeHelpId = useId()
  const sharedFieldsHelpId = useId()
  const providerGroupLabelId = useId()
  const resetDraftHelpId = useId()
  const userConfigValidationId = useId()

  const handleOpenChange = useCallback((next: boolean) => {
    if (next)
      setDraft(createEditableDraft(config, keySource))
    setOpen(next)
  }, [config, keySource, setOpen])

  const usingAuto = keySource === 'auto'
  const usingSharedDraft = draft.apiKey.trim().length === 0
  const missingUserEndpoint = !usingSharedDraft && draft.baseURL.trim().length === 0
  const missingUserModel = !usingSharedDraft && draft.model.trim().length === 0
  const userConfigIncomplete = missingUserEndpoint || missingUserModel
  const draftModeLabel = usingSharedDraft ? t`共享额度` : t`自己的 API Key`
  const usageApiKey = usingAuto && usingSharedDraft ? config.apiKey : ''
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
    if (userConfigIncomplete)
      return
    if (draft.apiKey.trim())
      setConfig(draft)
    else
      setSharedConfig()
    setOpen(false)
  }

  const handleReset = () => {
    setDraft(createEditableDraft(DEFAULT_LLM_CONFIG, 'auto'))
  }
  const handleProviderChange = (provider: LLMProvider) => {
    if (usingSharedDraft)
      return
    setDraft(switchProviderPreservingKey(draft, provider))
  }

  const visibleUsage: UsageState = usage.apiKey === usageApiKey
    ? usage
    : { totalGranted: 0, totalUsed: 0, totalAvailable: 0, loading: true }
  const usageReady = !visibleUsage.loading && !visibleUsage.error
  const lowBudget = usageReady && visibleUsage.totalAvailable > 0 && visibleUsage.totalAvailable < QUOTA_PER_USD * 0.01
  const exhausted = usageReady && visibleUsage.totalAvailable === 0 && visibleUsage.totalGranted > 0
  const usagePct = visibleUsage.totalGranted > 0 ? Math.min(100, Math.round((visibleUsage.totalUsed / visibleUsage.totalGranted) * 100)) : 0

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
            <Settings aria-hidden="true" className="size-4 text-tour-teal" />
            <Trans>AI 服务设置</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>未填写 API Key 时将使用共享额度；共享额度有限，可能会用完。</Trans>
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 mt-1 flex flex-wrap gap-1.5 px-1" aria-label={draftModeLabel}>
          {usingSharedDraft
            ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-tour-teal/30 bg-tour-teal/10 px-2 py-0.5 text-[10px] font-medium text-tour-teal">
                  <Wallet aria-hidden="true" className="size-2.5" />
                  <Trans>共享额度</Trans>
                </span>
              )
            : (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck aria-hidden="true" className="size-2.5" />
                  <Trans>自己的 API Key</Trans>
                </span>
              )}
          <span className="inline-flex items-center gap-1 rounded-full border border-tour-border/60 bg-tour-bg/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            {draft.model || <Trans>未填写模型</Trans>}
          </span>
        </div>
        <p id={modeHelpId} className="mb-1 px-1 text-[11px] leading-relaxed text-muted-foreground">
          {usingSharedDraft
            ? keySource === 'user'
              ? <Trans>已切回共享额度草稿；点击保存才会替换当前 API Key，取消会保留原设置。</Trans>
              : <Trans>当前将使用共享额度；填写自己的 API Key 后可编辑服务地址、API 风格和模型。</Trans>
            : <Trans>保存后将使用自己的 API Key；清空 API Key 可回到共享额度。</Trans>}
        </p>
        <p id={sharedFieldsHelpId} className="sr-only">
          <Trans>共享额度模式下此项由系统管理；填写自己的 API Key 后可以编辑。</Trans>
        </p>

        <div className="grid gap-3 py-1">
          <div className="grid gap-1">
            <div id={providerGroupLabelId} className="text-xs font-medium"><Trans>API 风格</Trans></div>
            <div
              role="group"
              aria-labelledby={providerGroupLabelId}
              aria-describedby={usingSharedDraft ? sharedFieldsHelpId : modeHelpId}
              className="grid grid-cols-2 gap-2"
            >
              {(['openai-compatible', 'anthropic'] satisfies LLMProvider[]).map(provider => (
                <Button
                  key={provider}
                  type="button"
                  variant={draft.provider === provider ? 'default' : 'outline'}
                  size="sm"
                  aria-pressed={draft.provider === provider}
                  aria-describedby={usingSharedDraft ? sharedFieldsHelpId : undefined}
                  disabled={usingSharedDraft}
                  title={usingSharedDraft ? t`填写自己的 API Key 后可修改 API 风格` : undefined}
                  onClick={() => handleProviderChange(provider)}
                  className="cursor-pointer disabled:cursor-not-allowed"
                >
                  {providerLabel(provider)}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="llm-base-url" className="text-xs"><Trans>服务地址</Trans></Label>
            <Input
              id="llm-base-url"
              value={draft.baseURL}
              disabled={usingSharedDraft}
              aria-invalid={missingUserEndpoint || undefined}
              aria-describedby={usingSharedDraft ? sharedFieldsHelpId : missingUserEndpoint ? userConfigValidationId : undefined}
              onChange={e => setDraft({ ...draft, baseURL: e.target.value })}
              placeholder="https://..."
              className="font-mono text-xs"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="llm-api-key" className="flex items-center gap-1 text-xs">
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
          <div className="grid gap-1">
            <Label htmlFor="llm-model" className="text-xs"><Trans>模型</Trans></Label>
            <Input
              id="llm-model"
              value={draft.model}
              disabled={usingSharedDraft}
              aria-invalid={missingUserModel || undefined}
              aria-describedby={usingSharedDraft ? sharedFieldsHelpId : missingUserModel ? userConfigValidationId : undefined}
              onChange={e => setDraft({ ...draft, model: e.target.value })}
              placeholder="model"
              className="font-mono text-xs"
            />
          </div>

          {userConfigIncomplete && (
            <p id={userConfigValidationId} role="alert" className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
              <CircleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
              <span><Trans>填写自己的 API Key 时，还需要服务地址和模型。</Trans></span>
            </p>
          )}

          {showUsage && (
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${exhausted || lowBudget ? 'border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300' : 'border-tour-border bg-tour-bg/40 text-muted-foreground'}`}
            >
              {visibleUsage.loading
                ? <Loader2 aria-hidden="true" className="size-3.5 mt-0.5 shrink-0 animate-spin text-muted-foreground" />
                : visibleUsage.error
                  ? <CircleAlert aria-hidden="true" className="size-3.5 mt-0.5 shrink-0 text-amber-500" />
                  : <Wallet aria-hidden="true" className={`size-3.5 mt-0.5 shrink-0 ${exhausted || lowBudget ? 'text-amber-500' : 'text-tour-teal'}`} />}
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
                            <span><Trans>剩余</Trans></span>
                            <span className="font-mono text-sm font-semibold text-foreground">
                              {quotaToUSD(visibleUsage.totalAvailable)}
                            </span>
                            <span className="opacity-70">
                              {' / '}
                              {quotaToUSD(visibleUsage.totalGranted)}
                            </span>
                          </div>
                          <div
                            role="progressbar"
                            aria-label={t`共享额度已使用量`}
                            aria-valuemin={0}
                            aria-valuemax={visibleUsage.totalGranted}
                            aria-valuenow={visibleUsage.totalUsed}
                            className="h-1.5 w-full overflow-hidden rounded-full bg-tour-border/60"
                          >
                            <div
                              className={`h-full rounded-full transition-all ${exhausted ? 'bg-amber-500' : 'bg-tour-teal'}`}
                              style={{ width: `${usagePct}%` }}
                            />
                          </div>
                        </div>
                      )}
              </div>
            </div>
          )}

          {showResetSchedule && (
            <div className="flex items-center gap-2 rounded-lg border border-tour-border/60 bg-tour-bg/40 px-3 py-2 text-[11px] text-muted-foreground">
              <CalendarClock aria-hidden="true" className="size-3.5 shrink-0 text-tour-teal" />
              <span>
                <Trans>下次刷新：</Trans>
                <span className="ml-1 font-mono text-foreground">{resetMoment}</span>
                <span className="ml-1 opacity-70"><Trans>（北京时间）</Trans></span>
              </span>
            </div>
          )}
        </div>
        <p id={resetDraftHelpId} className="sr-only">
          <Trans>仅重置当前表单；点击保存后才会生效，取消会保留已有设置。</Trans>
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
