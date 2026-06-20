'use client'

import { useId } from 'react'
import { ArrowRight, BookOpenCheck, CircleAlert, Code2, GraduationCap, Settings2, Sparkles, Target } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { useLLMConfig, useLLMConfigStore } from '@/stores/llmConfig'
import { isLLMConfigReady } from '@/lib/ai/model-provider'
import { formatResetMoment } from '@/modules/llm-config/runtime/format-reset-moment'
import { useLLMConfigBootstrap } from '@/modules/llm-config/runtime/useLLMConfigBootstrap'

export interface TeachLandingProps {
  /** Enter the teaching workspace. Only fires once the LLM config is ready. */
  onEnter: () => void
}

/**
 * Entry gate shown before the teaching workspace. Adapted from the legacy AI
 * classroom landing page, retheme­d to the standard workspace tokens and
 * stripped of the classroom-era topic/preview/session concepts the teach model
 * does not have.
 *
 * Its single job is the LLM-config gate: it runs {@link useLLMConfigBootstrap}
 * so an automatic shared key is fetched (the default `keySource === "auto"`
 * path), surfaces the current key source and shared-quota status, and only
 * enables "进入工作区" once {@link isLLMConfigReady} is true and the shared quota
 * is not exhausted. Without this gate the teacher agent would reach the central
 * views with no usable key and every browser→gateway POST would fail.
 */
export function TeachLanding({ onEnter }: TeachLandingProps) {
  // Fetch + apply the shared automatic key when none is configured. This is what
  // flips `configReady` to true under the default auto key source.
  useLLMConfigBootstrap()

  const config = useLLMConfig()
  const keySource = useLLMConfigStore(state => state.keySource)
  const autoQuota = useLLMConfigStore(state => state.autoQuota)
  const openSettings = useLLMConfigStore(state => state.setSettingsDialogOpen)

  const configReady = isLLMConfigReady(config)
  const sharedQuotaExhausted = keySource === 'auto' && autoQuota?.exhausted === true
  const canEnter = configReady && !sharedQuotaExhausted
  const quotaResetMoment = autoQuota?.nextResetAt ? formatResetMoment(autoQuota.nextResetAt) : ''

  const configHintId = useId()
  const quotaHintId = useId()

  const enterDescriptionId = !configReady
    ? configHintId
    : sharedQuotaExhausted
      ? quotaHintId
      : undefined

  const settingsActionTitle = sharedQuotaExhausted
    ? quotaResetMoment
      ? t`打开 AI 服务设置，改用自定义 API Key 后可立刻继续。共享额度下次刷新：${quotaResetMoment}。`
      : t`打开 AI 服务设置，改用自定义 API Key 后可立刻继续。`
    : t`打开 AI 服务设置，完成服务地址、API Key 和模型配置；不会进入工作区。`

  const enterActionTitle = canEnter
    ? t`进入教学工作区，开始按学习目标安排课程。`
    : settingsActionTitle

  return (
    <div
      data-testid="teach-landing"
      className="flex h-full min-h-0 flex-col bg-background text-foreground"
    >
      <header
        data-testid="teach-landing-header"
        className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2 sm:h-12 sm:flex-nowrap sm:px-5 sm:py-0"
      >
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <GraduationCap aria-hidden="true" className="size-4 text-primary" />
          <Trans>教学工作区</Trans>
        </span>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 overflow-x-auto overscroll-x-contain sm:flex-none sm:overflow-visible">
          <span
            data-testid="teach-landing-key-source"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1 text-xs font-medium text-muted-foreground"
          >
            {keySource === 'auto'
              ? <Trans>使用共享 AI 服务</Trans>
              : <Trans>使用自定义 API Key</Trans>}
          </span>
          <button
            type="button"
            data-testid="teach-landing-configure"
            title={settingsActionTitle}
            onClick={() => openSettings(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-md border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            <Settings2 aria-hidden="true" className="size-4" />
            {sharedQuotaExhausted ? <Trans>使用自定义 API Key</Trans> : <Trans>配置 AI 服务</Trans>}
          </button>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="flex min-w-0 items-center px-6 py-10 lg:min-h-0 lg:px-14">
          <div className="min-w-0 max-w-3xl">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="min-w-0 break-words"><Trans>AI 教学工作区</Trans></span>
            </div>
            <h1 className="mt-5 break-words text-4xl font-bold tracking-normal text-foreground md:text-5xl">
              <Trans>依据你的目标定制仓颉课程</Trans>
            </h1>
            <p className="mt-5 max-w-2xl break-words text-base leading-8 text-muted-foreground">
              <Trans>
                先与老师明确你的学习目的与预期成果，工作区将据此安排课程、练习与复习。整个工作区即一份可导出的文件，进度始终保存在本机。
              </Trans>
            </p>

            {sharedQuotaExhausted && (
              <div
                data-testid="teach-landing-quota-exhausted"
                className="mt-5 flex min-w-0 max-w-2xl items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm leading-7 text-amber-700 dark:text-amber-300"
              >
                <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <div className="min-w-0">
                  <p className="break-words font-semibold">
                    <Trans>今日共享额度已用完。</Trans>
                  </p>
                  <p className="mt-1 break-words text-xs leading-6">
                    {quotaResetMoment
                      ? (
                          <Trans>
                            额度会在
                            {quotaResetMoment}
                            刷新后自动恢复；改用自定义 API Key 可立刻继续。
                          </Trans>
                        )
                      : <Trans>刷新后会自动恢复；改用自定义 API Key 可立刻继续。</Trans>}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-8 flex min-w-0 flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!canEnter}
                aria-describedby={enterDescriptionId}
                title={enterActionTitle}
                onClick={() => {
                  if (canEnter)
                    onEnter()
                }}
                data-testid="teach-landing-enter"
                className="inline-flex max-w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-left text-sm font-semibold text-primary-foreground shadow-sm hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="min-w-0 break-words"><Trans>进入工作区</Trans></span>
                <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
              </button>
              {!configReady && (
                <span id={configHintId} className="max-w-full break-words text-xs leading-6 text-muted-foreground">
                  <Trans>完成服务地址、API Key 和模型配置后即可进入。</Trans>
                </span>
              )}
              {configReady && sharedQuotaExhausted && (
                <span id={quotaHintId} className="max-w-sm text-xs leading-6 text-muted-foreground">
                  <Trans>共享额度已用完，改用自定义 API Key 可立刻进入。</Trans>
                </span>
              )}
            </div>
          </div>
        </section>

        <aside className="min-w-0 border-t border-border/60 bg-muted/20 px-6 py-8 lg:border-l lg:border-t-0 lg:px-8">
          <div className="space-y-5">
            <section className="min-w-0 rounded-md border border-border/60 bg-background p-4">
              <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
                <Target aria-hidden="true" className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 break-words"><Trans>目标优先</Trans></span>
              </div>
              <p className="mt-2 break-words text-sm leading-7 text-muted-foreground">
                <Trans>先明确你希望用仓颉实现的目标，老师据此安排课程，而非套用固定大纲。</Trans>
              </p>
            </section>
            <section className="min-w-0 rounded-md border border-border/60 bg-background p-4">
              <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
                <Code2 aria-hidden="true" className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 break-words"><Trans>动手练习</Trans></span>
              </div>
              <p className="mt-2 break-words text-sm leading-7 text-muted-foreground">
                <Trans>在内置编辑器中编写仓颉代码并直接运行查看结果，老师据此给出反馈。</Trans>
              </p>
            </section>
            <section className="min-w-0 rounded-md border border-border/60 bg-background p-4">
              <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
                <BookOpenCheck aria-hidden="true" className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 break-words"><Trans>复习巩固</Trans></span>
              </div>
              <p className="mt-2 break-words text-sm leading-7 text-muted-foreground">
                <Trans>依据记忆曲线安排复习，帮助你长期留存所学内容。</Trans>
              </p>
            </section>
          </div>
        </aside>
      </main>
    </div>
  )
}
