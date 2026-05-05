'use client'

import { useCallback, useEffect, useState } from 'react'
import { CircleAlert, KeyRound, Loader2, RotateCw, Settings, ShieldCheck, Wallet } from 'lucide-react'
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
import type { LLMProvider } from '@/lib/ai/model-provider'

interface UsageState {
  totalGranted: number
  totalUsed: number
  totalAvailable: number
  loading: boolean
  error?: string
}

const QUOTA_PER_USD = 500_000

const NEW_API_BASE_URL = (process.env.NEXT_PUBLIC_NEW_API_BASE_URL || 'https://llm.learningman.top').replace(/\/$/, '')

async function fetchUsage(apiKey: string): Promise<UsageState> {
  try {
    const url = `${NEW_API_BASE_URL}/api/usage/token/`
    const resp = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!resp.ok)
      return { totalGranted: 0, totalUsed: 0, totalAvailable: 0, loading: false, error: `HTTP ${resp.status}` }
    const json = await resp.json() as { data?: { total_granted?: number, total_used?: number, total_available?: number } }
    const data = json.data ?? {}
    return {
      totalGranted: data.total_granted ?? 0,
      totalUsed: data.total_used ?? 0,
      totalAvailable: data.total_available ?? 0,
      loading: false,
    }
  }
  catch (e) {
    return { totalGranted: 0, totalUsed: 0, totalAvailable: 0, loading: false, error: (e as Error).message }
  }
}

function quotaToUSD(q: number): string {
  return `$${(q / QUOTA_PER_USD).toFixed(4)}`
}

export function LLMConfigDialog() {
  const config = useLLMConfigStore(state => state.config)
  const setConfig = useLLMConfigStore(state => state.setConfig)
  const reset = useLLMConfigStore(state => state.reset)
  const keySource = useLLMConfigStore(state => state.keySource)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(config)
  const [usage, setUsage] = useState<UsageState>({ totalGranted: 0, totalUsed: 0, totalAvailable: 0, loading: true })

  const handleOpenChange = useCallback((next: boolean) => {
    if (next)
      setDraft(config)
    setOpen(next)
  }, [config])

  const usingAuto = keySource === 'auto'
  const showUsage = open && usingAuto && draft.apiKey === config.apiKey && draft.apiKey.length > 0

  useEffect(() => {
    if (!showUsage)
      return
    let cancelled = false
    void fetchUsage(draft.apiKey).then((u) => {
      if (!cancelled)
        setUsage(u)
    })
    return () => {
      cancelled = true
    }
  }, [showUsage, draft.apiKey])

  const handleSave = () => {
    setConfig(draft)
    setOpen(false)
  }

  const handleReset = () => {
    reset()
    setDraft(DEFAULT_LLM_CONFIG)
  }
  const handleProviderChange = (provider: LLMProvider) => {
    setDraft(switchProviderPreservingKey(draft, provider))
  }

  const usageReady = !usage.loading && !usage.error
  const lowBudget = usageReady && usage.totalAvailable > 0 && usage.totalAvailable < QUOTA_PER_USD * 0.01
  const exhausted = usageReady && usage.totalAvailable === 0 && usage.totalGranted > 0
  const usagePct = usage.totalGranted > 0 ? Math.min(100, Math.round((usage.totalUsed / usage.totalGranted) * 100)) : 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          aria-label={t`LLM 设置`}
          title={t`LLM 设置`}
          className="inline-flex size-7 cursor-pointer items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-200/60"
        >
          <Settings className="size-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="size-4 text-tour-teal" />
            <Trans>LLM 设置</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>未填写 API Key 时将自动使用基于访客 IP 颁发的限额 Key。</Trans>
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 mt-1 mb-1 flex flex-wrap gap-1.5 px-1">
          {usingAuto
            ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-tour-teal/30 bg-tour-teal/10 px-2 py-0.5 text-[10px] font-medium text-tour-teal">
                  <Wallet className="size-2.5" />
                  <Trans>共享额度</Trans>
                </span>
              )
            : (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="size-2.5" />
                  <Trans>自带 Key</Trans>
                </span>
              )}
          <span className="inline-flex items-center gap-1 rounded-full border border-tour-border/60 bg-tour-bg/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            {draft.model || '未填写模型'}
          </span>
        </div>

        <div className="grid gap-3 py-1">
          <div className="grid gap-1">
            <Label className="text-xs">API 风格</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['openai-compatible', 'anthropic'] satisfies LLMProvider[]).map(provider => (
                <Button
                  key={provider}
                  type="button"
                  variant={draft.provider === provider ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleProviderChange(provider)}
                  className="cursor-pointer"
                >
                  {providerLabel(provider)}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="llm-base-url" className="text-xs">API Base</Label>
            <Input
              id="llm-base-url"
              value={draft.baseURL}
              onChange={e => setDraft({ ...draft, baseURL: e.target.value })}
              placeholder="https://..."
              className="font-mono text-xs"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="llm-api-key" className="flex items-center gap-1 text-xs">
              <KeyRound className="size-3" />
              API Key
            </Label>
            <Input
              id="llm-api-key"
              type="password"
              autoComplete="off"
              value={draft.apiKey}
              onChange={e => setDraft({ ...draft, apiKey: e.target.value })}
              placeholder={t`留空使用共享额度`}
              className="font-mono text-xs"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="llm-model" className="text-xs"><Trans>Model</Trans></Label>
            <Input
              id="llm-model"
              value={draft.model}
              onChange={e => setDraft({ ...draft, model: e.target.value })}
              placeholder="model"
              className="font-mono text-xs"
            />
          </div>

          {showUsage && (
            <div
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${exhausted || lowBudget ? 'border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300' : 'border-tour-border bg-tour-bg/40 text-muted-foreground'}`}
            >
              {usage.loading
                ? <Loader2 className="size-3.5 mt-0.5 shrink-0 animate-spin text-muted-foreground" />
                : usage.error
                  ? <CircleAlert className="size-3.5 mt-0.5 shrink-0 text-amber-500" />
                  : <Wallet className={`size-3.5 mt-0.5 shrink-0 ${exhausted || lowBudget ? 'text-amber-500' : 'text-tour-teal'}`} />}
              <div className="flex-1 leading-relaxed">
                {usage.loading
                  ? <Trans>正在加载剩余额度…</Trans>
                  : usage.error
                    ? (
                        <span>
                          <Trans>无法读取剩余额度：</Trans>
                          <span className="font-mono">{usage.error}</span>
                        </span>
                      )
                    : (
                        <div className="space-y-1">
                          <div className="flex items-baseline gap-1.5">
                            <span><Trans>剩余</Trans></span>
                            <span className="font-mono text-sm font-semibold text-foreground">
                              {quotaToUSD(usage.totalAvailable)}
                            </span>
                            <span className="opacity-70">
                              {' / '}
                              {quotaToUSD(usage.totalGranted)}
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-tour-border/60">
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
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={handleReset} className="cursor-pointer">
            <RotateCw className="size-3.5 mr-1" />
            <Trans>重置默认</Trans>
          </Button>
          <div className="flex gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm" className="cursor-pointer"><Trans>取消</Trans></Button>
            </DialogClose>
            <Button type="button" size="sm" onClick={handleSave} className="cursor-pointer"><Trans>保存</Trans></Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
