'use client'

import { useId, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CircleAlert, Loader2, ShieldCheck, Wallet } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useLLMConfig, useLLMConfigStore } from '@/stores/llmConfig'
import type { LLMConfig } from '@/lib/ai/model-provider'
import { isLLMConfigReady, resolveProviderDefaults } from '@/lib/ai/model-provider'
import { formatResetMoment } from '@/modules/llm-config/runtime/format-reset-moment'
import { useLLMConfigBootstrap } from '@/modules/llm-config/runtime/useLLMConfigBootstrap'
import { useSharedQuota } from '@/modules/llm-config/runtime/useSharedQuota'
import { LLMConfigFields } from '@/modules/llm-config/components/LLMConfigFields'
import { TeachTopBar } from './TeachTopBar'

export interface TeachConfigWizardProps {
  /** Enter the classroom workspace. Only fires once a usable LLM config is ready. */
  onEnter: () => void
  /** Go back to the intro landing page. */
  onBack: () => void
}

type WizardStep = 'source' | 'credentials'
type ConfigSource = 'shared' | 'custom'

/**
 * The configuration step between the intro landing and the workspace: a short
 * wizard that walks the learner through picking an AI source.
 *
 *  - **Step 1 — choose source:** shared AI service (the default, auto-provisioned
 *    key fetched by {@link useLLMConfigBootstrap}) or a custom API Key. Picking
 *    shared while a personal key is active switches back to the shared key so the
 *    bootstrap re-fetches it.
 *  - **Step 2 — credentials (custom only):** the {@link LLMConfigFields} form
 *    (API style / service address / API Key / model).
 *
 * "进入工作区" only fires once the chosen source is usable — the shared key is
 * loaded and not exhausted, or the custom config is complete.
 */
export function TeachConfigWizard({ onEnter, onBack }: TeachConfigWizardProps) {
  const bootstrap = useLLMConfigBootstrap()
  const config = useLLMConfig()
  const keySource = useLLMConfigStore(state => state.keySource)
  const autoQuota = useLLMConfigStore(state => state.autoQuota)
  const setConfig = useLLMConfigStore(state => state.setConfig)
  const setSharedConfig = useLLMConfigStore(state => state.setSharedConfig)

  const [step, setStep] = useState<WizardStep>('source')
  const [source, setSource] = useState<ConfigSource>(keySource === 'user' ? 'custom' : 'shared')
  // The custom-config draft, seeded from the active personal key (if any) or the
  // OpenAI-compatible defaults. Edited in step 2; only committed on "进入工作区".
  const [draft, setDraft] = useState<LLMConfig>(() =>
    keySource === 'user' ? { ...config } : resolveProviderDefaults('openai-compatible'))
  const validationId = useId()
  const sourceGroupLabelId = useId()

  const sharedQuotaExhausted = keySource === 'auto' && autoQuota?.exhausted === true
  const sharedReady = keySource === 'auto' && isLLMConfigReady(config) && !sharedQuotaExhausted
  const customComplete = isLLMConfigReady(draft)
  const quotaResetMoment = autoQuota?.nextResetAt ? formatResetMoment(autoQuota.nextResetAt) : ''
  // Today's remaining share of the per-period budget, as a 0–100 percentage. The
  // live probe stays fresh on returning visits (where the cached key skips the
  // bootstrap); the bootstrap snapshot gives an instant first paint when present.
  const liveQuota = useSharedQuota(sharedReady)
  const snapshotPercent = autoQuota?.perPeriod && typeof autoQuota.available === 'number'
    ? Math.max(0, Math.min(100, Math.round((autoQuota.available / autoQuota.perPeriod) * 100)))
    : null
  const quotaPercent = liveQuota.percent ?? snapshotPercent
  const quotaLoading = liveQuota.loading

  const selectSource = (next: ConfigSource) => {
    setSource(next)
    // Switching back to shared drops the personal key so the bootstrap re-fetches
    // the shared one; selecting custom only edits the local draft.
    if (next === 'shared' && keySource !== 'auto')
      setSharedConfig()
  }

  const handleSourceKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key))
      return
    const radios = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'))
    const current = radios.indexOf(document.activeElement as HTMLButtonElement)
    if (current < 0 || radios.length === 0)
      return
    event.preventDefault()
    const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1
    const next = (current + direction + radios.length) % radios.length
    radios[next]?.focus()
    radios[next]?.click()
  }

  const handleSourceNext = () => {
    if (source === 'custom') {
      setStep('credentials')
      return
    }
    if (sharedReady)
      onEnter()
  }

  const handleCustomEnter = () => {
    if (!customComplete)
      return
    setConfig(draft)
    onEnter()
  }

  return (
    <div data-testid="teach-config" className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <TeachTopBar
        backLabel={t`返回介绍页`}
        backTestId="teach-config-back-landing"
        onBack={onBack}
      />

      <main className="teach-ambient flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-8 sm:px-6 sm:py-12">
        <div className="w-full max-w-xl rounded-3xl border border-border/75 bg-card/92 p-5 shadow-[0_28px_80px_-46px_rgba(19,72,59,0.45)] backdrop-blur-sm sm:p-7">
          <div aria-hidden="true" className="mb-6 grid grid-cols-2 gap-2">
            <span className="h-1.5 rounded-full bg-primary" />
            <span className={cn('h-1.5 rounded-full transition-colors', step === 'credentials' ? 'bg-primary' : 'bg-muted')} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/80">
            {step === 'source'
              ? <Trans>第 1 步 · 选择 AI 来源</Trans>
              : <Trans>第 2 步 · 配置 API 服务</Trans>}
          </p>
          <h1 id={sourceGroupLabelId} className="mt-2 text-balance text-2xl font-bold tracking-[-0.02em] text-foreground sm:text-[1.75rem]">
            {step === 'source'
              ? <Trans>先选择驱动课堂的 AI 服务</Trans>
              : <Trans>填写你的 API 服务</Trans>}
          </h1>

          {step === 'source'
            ? (
                <div
                  data-testid="teach-wizard-step-source"
                  role="radiogroup"
                  aria-labelledby={sourceGroupLabelId}
                  onKeyDown={handleSourceKeyDown}
                  className="mt-7 flex flex-col gap-3"
                >
                  <SourceOption
                    testId="teach-source-shared"
                    selected={source === 'shared'}
                    onSelect={() => selectSource('shared')}
                    icon={Wallet}
                    title={<Trans>共享 AI 服务</Trans>}
                    description={<Trans>推荐 · 开箱即用，无需任何配置。</Trans>}
                  >
                    <SharedStatus
                      exhausted={sharedQuotaExhausted}
                      ready={sharedReady}
                      status={bootstrap.status}
                      resetMoment={quotaResetMoment}
                      quotaPercent={quotaPercent}
                      quotaLoading={quotaLoading}
                    />
                  </SourceOption>

                  <SourceOption
                    testId="teach-source-custom"
                    selected={source === 'custom'}
                    onSelect={() => selectSource('custom')}
                    icon={ShieldCheck}
                    title={<Trans>使用自定义 API Key</Trans>}
                    description={<Trans>接入你自己的 OpenAI 兼容或 Anthropic 服务。</Trans>}
                  />

                  <div className="mt-2 flex items-center gap-3">
                    <Button
                      type="button"
                      size="lg"
                      data-testid="teach-source-next"
                      disabled={source === 'shared' && !sharedReady}
                      onClick={handleSourceNext}
                      className="h-11 rounded-xl px-5 font-semibold shadow-sm"
                    >
                      {source === 'custom' ? <Trans>下一步</Trans> : <Trans>进入工作区</Trans>}
                      <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
                    </Button>
                  </div>
                </div>
              )
            : (
                <div data-testid="teach-wizard-step-credentials" className="mt-7 flex flex-col gap-4">
                  <LLMConfigFields
                    value={draft}
                    onChange={setDraft}
                    apiKeyPlaceholder={t`填写你的 API Key`}
                    validationId={validationId}
                  />
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      data-testid="teach-wizard-back"
                      onClick={() => setStep('source')}
                      className="rounded-xl text-muted-foreground"
                    >
                      <ArrowLeft aria-hidden="true" className="size-4 shrink-0" />
                      <Trans>上一步</Trans>
                    </Button>
                    <Button
                      type="button"
                      size="lg"
                      data-testid="teach-config-enter"
                      disabled={!customComplete}
                      onClick={handleCustomEnter}
                      className="h-11 rounded-xl px-5 font-semibold shadow-sm"
                    >
                      <Trans>进入工作区</Trans>
                      <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
                    </Button>
                  </div>
                </div>
              )}
        </div>
      </main>
    </div>
  )
}

interface SourceOptionProps {
  testId: string
  selected: boolean
  onSelect: () => void
  icon: typeof Wallet
  title: React.ReactNode
  description: React.ReactNode
  children?: React.ReactNode
}

/** A selectable AI-source card (radio-like) for step 1. */
function SourceOption({ testId, selected, onSelect, icon: Icon, title, description, children }: SourceOptionProps) {
  return (
    <button
      type="button"
      data-testid={testId}
      role="radio"
      aria-checked={selected}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      className={cn(
        'group relative flex w-full flex-col gap-1 rounded-2xl border px-4 py-4 pe-12 text-start outline-none transition-[border-color,background-color,box-shadow,transform] focus-visible:ring-2 focus-visible:ring-ring/35 motion-reduce:transform-none',
        selected
          ? 'border-primary/60 bg-primary/7 shadow-[0_12px_30px_-24px_rgba(16,100,82,0.55)]'
          : 'border-border/75 bg-background/70 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-muted/45',
      )}
    >
      <span className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon aria-hidden="true" className="size-4" />
        </span>
        {title}
      </span>
      <span className="ps-10 text-xs leading-6 text-muted-foreground">{description}</span>
      {children}
      <span
        aria-hidden="true"
        className={cn(
          'absolute end-4 top-4 grid size-5 place-items-center rounded-full border transition-colors',
          selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-transparent',
        )}
      >
        <Check className="size-3" />
      </span>
    </button>
  )
}

interface SharedStatusProps {
  exhausted: boolean
  ready: boolean
  status: 'loading' | 'ready' | 'error'
  resetMoment: string
  /** Today's remaining quota as a 0–100 percentage, or null when unknown. */
  quotaPercent: number | null
  /** True while the live quota probe is in flight (show the meter's spinner). */
  quotaLoading: boolean
}

/** Inline readiness line for the shared-service option. */
function SharedStatus({ exhausted, ready, status, resetMoment, quotaPercent, quotaLoading }: SharedStatusProps) {
  if (exhausted) {
    return (
      <span data-testid="teach-config-quota-exhausted" className="mt-1 inline-flex items-start gap-1.5 ps-10 text-xs leading-6 text-amber-700 dark:text-amber-300">
        <CircleAlert aria-hidden="true" className="mt-1 size-3.5 shrink-0" />
        <span>
          {resetMoment
            ? (
                <Trans>
                  今日共享额度已用完，
                  {resetMoment}
                  {' '}
                  刷新；可改用自定义 API Key。
                </Trans>
              )
            : <Trans>今日共享额度已用完；可改用自定义 API Key。</Trans>}
        </span>
      </span>
    )
  }
  if (ready) {
    // The quota meter keeps a constant height across its loading and loaded
    // states, so it replaces the ready line in place (no layout shift). Fall back
    // to a plain ready line only when the quota probe is unavailable.
    if (quotaPercent != null || quotaLoading)
      return <QuotaMeter percent={quotaPercent} />
    return (
      <span className="mt-1 inline-flex items-center gap-1.5 ps-10 text-xs text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 aria-hidden="true" className="size-3.5 shrink-0" />
        <Trans>已就绪，可直接进入</Trans>
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="mt-1 inline-flex items-start gap-1.5 ps-10 text-xs leading-6 text-amber-700 dark:text-amber-300">
        <CircleAlert aria-hidden="true" className="mt-1 size-3.5 shrink-0" />
        <Trans>共享服务暂不可用，可改用自定义 API Key。</Trans>
      </span>
    )
  }
  return (
    <span className="mt-1 inline-flex items-center gap-1.5 ps-10 text-xs text-muted-foreground">
      <Loader2 aria-hidden="true" className="size-3.5 shrink-0 animate-spin" />
      <Trans>正在准备共享服务…</Trans>
    </span>
  )
}

/**
 * A slim daily-quota meter: a labelled percentage over a thin progress bar,
 * tinted by how much remains (emerald when healthy, amber when low, rose when
 * nearly out). While the value is loading (`percent` is null) it shows a spinner
 * in the same two-row footprint, so swapping to the loaded bar never shifts the
 * card height.
 */
function QuotaMeter({ percent }: { percent: number | null }) {
  if (percent === null) {
    return (
      <span role="progressbar" aria-label={t`今日额度剩余`} className="mt-1 flex flex-col gap-1 ps-10">
        <span className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground"><Trans>今日额度剩余</Trans></span>
          <Loader2 aria-hidden="true" className="size-3 shrink-0 animate-spin text-muted-foreground" />
        </span>
        <span className="h-1 rounded-full bg-muted" />
      </span>
    )
  }
  const tone = percent < 10
    ? { text: 'text-rose-600 dark:text-rose-400', bar: 'bg-rose-500' }
    : percent < 30
      ? { text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500' }
      : { text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' }
  return (
    <span
      role="progressbar"
      aria-label={t`今日额度剩余`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="mt-1 flex flex-col gap-1 ps-10"
    >
      <span className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground"><Trans>今日额度剩余</Trans></span>
        <span className={cn('text-[11px] font-medium tabular-nums', tone.text)}>{`${percent}%`}</span>
      </span>
      <span className="h-1 overflow-hidden rounded-full bg-muted">
        <span
          className={cn('block h-full rounded-full transition-[width] duration-500', tone.bar)}
          style={{ width: `${percent}%` }}
        />
      </span>
    </span>
  )
}
