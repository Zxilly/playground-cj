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
import { DEFAULT_LLM_CONFIG, useLLMConfig } from '@/contexts/LLMConfigContext'

interface BudgetState {
  remainingUSD: number
  resetAt: number
  resetInSec?: number
  loading: boolean
  error?: string
}

async function fetchBudget(baseURL: string): Promise<BudgetState> {
  try {
    const url = `${baseURL.replace(/\/$/, '')}/budget`
    const resp = await fetch(url, { method: 'GET' })
    if (!resp.ok)
      return { remainingUSD: 0, resetAt: 0, loading: false, error: `HTTP ${resp.status}` }
    const json = await resp.json() as { remainingUSD: number, resetAt: number, resetInSec?: number }
    return {
      remainingUSD: json.remainingUSD,
      resetAt: json.resetAt,
      resetInSec: json.resetInSec,
      loading: false,
    }
  }
  catch (e) {
    return { remainingUSD: 0, resetAt: 0, loading: false, error: (e as Error).message }
  }
}

function formatDuration(seconds: number): string {
  if (seconds <= 0)
    return '<1m'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0)
    return `${h}h ${m}m`
  if (m > 0)
    return `${m}m`
  return `${Math.max(1, Math.floor(seconds))}s`
}

export function LLMConfigDialog() {
  const { config, setConfig, reset } = useLLMConfig()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(config)
  const [budget, setBudget] = useState<BudgetState>({ remainingUSD: 0, resetAt: 0, loading: true })

  const handleOpenChange = useCallback((next: boolean) => {
    if (next)
      setDraft(config)
    setOpen(next)
  }, [config])

  useEffect(() => {
    if (!open)
      return
    let cancelled = false
    void fetchBudget(draft.baseURL).then((b) => {
      if (!cancelled)
        setBudget(b)
    })
    return () => {
      cancelled = true
    }
  }, [open, draft.baseURL])

  const handleSave = () => {
    setConfig(draft)
    setOpen(false)
  }

  const handleReset = () => {
    reset()
    setDraft(DEFAULT_LLM_CONFIG)
  }

  const usingShared = !draft.apiKey
  const lowBudget = !budget.loading && !budget.error && usingShared && budget.remainingUSD < 0.01
  const resetSec = budget.resetInSec ?? 0

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
            <Trans>未填写 API Key 时将使用 cj-api 的共享试用额度，按 IP 限流。</Trans>
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 mt-1 mb-1 flex flex-wrap gap-1.5 px-1">
          {usingShared
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
            {draft.model || 'gpt-4o-mini'}
          </span>
        </div>

        <div className="grid gap-3 py-1">
          <div className="grid gap-1">
            <Label htmlFor="llm-base-url" className="text-xs"><Trans>Base URL</Trans></Label>
            <Input
              id="llm-base-url"
              value={draft.baseURL}
              onChange={e => setDraft({ ...draft, baseURL: e.target.value })}
              placeholder="https://api.openai.com/v1"
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
              placeholder="gpt-4o-mini"
              className="font-mono text-xs"
            />
          </div>

          {usingShared && (
            <div
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${lowBudget ? 'border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300' : 'border-tour-border bg-tour-bg/40 text-muted-foreground'}`}
            >
              {budget.loading
                ? <Loader2 className="size-3.5 mt-0.5 shrink-0 animate-spin text-muted-foreground" />
                : budget.error
                  ? <CircleAlert className="size-3.5 mt-0.5 shrink-0 text-amber-500" />
                  : <Wallet className={`size-3.5 mt-0.5 shrink-0 ${lowBudget ? 'text-amber-500' : 'text-tour-teal'}`} />}
              <div className="flex-1 leading-relaxed">
                {budget.loading
                  ? <Trans>正在加载剩余额度…</Trans>
                  : budget.error
                    ? (
                        <span>
                          <Trans>无法读取剩余额度：</Trans>
                          <span className="font-mono">{budget.error}</span>
                        </span>
                      )
                    : (
                        <div className="space-y-0.5">
                          <div className="flex items-baseline gap-1.5">
                            <span><Trans>共享额度剩余</Trans></span>
                            <span className="font-mono text-sm font-semibold text-foreground">
                              {`$${budget.remainingUSD.toFixed(4)}`}
                            </span>
                          </div>
                          {resetSec > 0 && (
                            <div className="text-[10px] text-muted-foreground">
                              <Trans>下次重置</Trans>
                              {' · '}
                              <span className="font-mono">{formatDuration(resetSec)}</span>
                            </div>
                          )}
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
