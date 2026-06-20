'use client'

import { useId, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, GraduationCap, Loader2, ShieldCheck, Wallet } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { cn } from '@/lib/utils'
import { useLLMConfig, useLLMConfigStore } from '@/stores/llmConfig'
import type { LLMConfig } from '@/lib/ai/model-provider'
import { isLLMConfigReady, resolveProviderDefaults } from '@/lib/ai/model-provider'
import { formatResetMoment } from '@/modules/llm-config/runtime/format-reset-moment'
import { useLLMConfigBootstrap } from '@/modules/llm-config/runtime/useLLMConfigBootstrap'
import { LLMConfigFields } from '@/modules/llm-config/components/LLMConfigFields'

export interface TeachLandingProps {
  /** Enter the teaching workspace. Only fires once a usable LLM config is ready. */
  onEnter: () => void
}

type WizardStep = 'source' | 'credentials'
type ConfigSource = 'shared' | 'custom'

/**
 * Startup onboarding gate: a short wizard that walks the learner through picking
 * an AI source before entering the workspace, instead of leaving the model
 * configuration to a tucked-away settings button.
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
export function TeachLanding({ onEnter }: TeachLandingProps) {
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

  const sharedQuotaExhausted = keySource === 'auto' && autoQuota?.exhausted === true
  const sharedReady = keySource === 'auto' && isLLMConfigReady(config) && !sharedQuotaExhausted
  const customComplete = isLLMConfigReady(draft)
  const quotaResetMoment = autoQuota?.nextResetAt ? formatResetMoment(autoQuota.nextResetAt) : ''

  const selectSource = (next: ConfigSource) => {
    setSource(next)
    // Switching back to shared drops the personal key so the bootstrap re-fetches
    // the shared one; selecting custom only edits the local draft.
    if (next === 'shared' && keySource !== 'auto')
      setSharedConfig()
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
    <div data-testid="teach-landing" className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center border-b border-border/60 px-5">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <GraduationCap aria-hidden="true" className="size-4 text-primary" />
          <Trans>教学工作区</Trans>
        </span>
      </header>

      <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-8">
        <div className="w-full max-w-lg">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {step === 'source'
              ? <Trans>第 1 步 · 选择 AI 来源</Trans>
              : <Trans>第 2 步 · 配置 API 服务</Trans>}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-foreground">
            {step === 'source'
              ? <Trans>先选择驱动老师的 AI 服务</Trans>
              : <Trans>填写你的 API 服务</Trans>}
          </h1>

          {step === 'source'
            ? (
                <div data-testid="teach-wizard-step-source" className="mt-6 flex flex-col gap-3">
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
                    <button
                      type="button"
                      data-testid="teach-source-next"
                      disabled={source === 'shared' && !sharedReady}
                      onClick={handleSourceNext}
                      className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {source === 'custom' ? <Trans>下一步</Trans> : <Trans>进入工作区</Trans>}
                      <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
                    </button>
                    {source === 'shared' && !sharedReady && !sharedQuotaExhausted && (
                      <span className="text-xs leading-6 text-muted-foreground">
                        <Trans>正在准备共享服务…</Trans>
                      </span>
                    )}
                  </div>
                </div>
              )
            : (
                <div data-testid="teach-wizard-step-credentials" className="mt-6 flex flex-col gap-3">
                  <LLMConfigFields
                    value={draft}
                    onChange={setDraft}
                    apiKeyPlaceholder={t`填写你的 API Key`}
                    validationId={validationId}
                  />
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      data-testid="teach-wizard-back"
                      onClick={() => setStep('source')}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    >
                      <ArrowLeft aria-hidden="true" className="size-4 shrink-0" />
                      <Trans>上一步</Trans>
                    </button>
                    <button
                      type="button"
                      data-testid="teach-landing-enter"
                      disabled={!customComplete}
                      onClick={handleCustomEnter}
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trans>进入工作区</Trans>
                      <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
                    </button>
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
      onClick={onSelect}
      className={cn(
        'flex w-full flex-col gap-1 rounded-lg border px-4 py-3 text-start transition-colors',
        selected ? 'border-primary bg-primary/5' : 'border-border/60 hover:bg-muted/40',
      )}
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon aria-hidden="true" className="size-4 shrink-0 text-primary" />
        {title}
      </span>
      <span className="text-xs leading-6 text-muted-foreground">{description}</span>
      {children}
    </button>
  )
}

interface SharedStatusProps {
  exhausted: boolean
  ready: boolean
  status: 'loading' | 'ready' | 'error'
  resetMoment: string
}

/** Inline readiness line for the shared-service option. */
function SharedStatus({ exhausted, ready, status, resetMoment }: SharedStatusProps) {
  if (exhausted) {
    return (
      <span data-testid="teach-landing-quota-exhausted" className="mt-1 inline-flex items-start gap-1.5 text-xs leading-6 text-amber-700 dark:text-amber-300">
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
    return (
      <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 aria-hidden="true" className="size-3.5 shrink-0" />
        <Trans>已就绪，可直接进入</Trans>
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="mt-1 inline-flex items-start gap-1.5 text-xs leading-6 text-amber-700 dark:text-amber-300">
        <CircleAlert aria-hidden="true" className="mt-1 size-3.5 shrink-0" />
        <Trans>共享服务暂不可用，可改用自定义 API Key。</Trans>
      </span>
    )
  }
  return (
    <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Loader2 aria-hidden="true" className="size-3.5 shrink-0 animate-spin" />
      <Trans>正在准备共享服务…</Trans>
    </span>
  )
}
