'use client'

import { useId } from 'react'
import { BookOpenCheck, GraduationCap, KeyRound, Loader2, MessagesSquare, Settings2, Sparkles } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { useLLMConfigStore } from '@/stores/llmConfig'
import { formatResetMoment } from '@/modules/llm-config/runtime/format-reset-moment'

interface ClassroomWelcomeCardProps {
  /** Whether the LLM endpoint, API key, and model are all configured. */
  configReady: boolean
}

// First-paint card the learner sees in AI Mode. Previously the empty state was
// a single line ("正在规划下一步") — that left a new visitor with no idea what
// the page actually does, whether to wait, click something, or go elsewhere.
// This card replaces it with a value pitch + a clear next step that depends on
// whether the LLM is configured yet.
export function ClassroomWelcomeCard({ configReady }: ClassroomWelcomeCardProps) {
  const openSettings = useLLMConfigStore(state => state.setSettingsDialogOpen)
  const keySource = useLLMConfigStore(state => state.keySource)
  const autoQuota = useLLMConfigStore(state => state.autoQuota)
  const configDescriptionId = useId()
  const quotaDescriptionId = useId()
  const sharedQuotaExhausted = configReady && keySource === 'auto' && autoQuota?.exhausted === true
  const quotaResetMoment = autoQuota?.nextResetAt ? formatResetMoment(autoQuota.nextResetAt) : ''
  const settingsActionTitle = sharedQuotaExhausted
    ? quotaResetMoment
      ? t`打开 AI 服务设置，改用自己的 API Key 后可立刻继续；不会排队新的课堂请求或记录学习进度。共享额度下次刷新：${quotaResetMoment}。`
      : t`打开 AI 服务设置，改用自己的 API Key 后可立刻继续；不会排队新的课堂请求或记录学习进度。`
    : t`打开 AI 服务设置，完成服务地址、API Key 和模型配置；不会进入课堂、排队 AI 请求或记录学习进度。`

  return (
    <section
      data-testid="classroom-welcome-card"
      className="min-w-0 rounded-md border border-tour-border bg-tour-surface p-6"
    >
      <div
        className="inline-flex max-w-full items-center gap-2 rounded-full bg-tour-bg px-3 py-1 text-xs font-medium text-tour-link"
      >
        <Sparkles aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="min-w-0 break-words"><Trans>AI 课堂</Trans></span>
      </div>

      <h2
        className="mt-4 break-words text-xl font-bold text-tour-heading"
      >
        <Trans>准备开始 AI 课堂</Trans>
      </h2>

      <p
        className="mt-2 break-words text-sm leading-7 text-muted-foreground"
      >
        <Trans>
          AI 课堂会从当前教程主题开始，展示讲解、练习和答疑入口。
          你可以选择放慢节奏、深入讲解，或者解释刚才的错误。
        </Trans>
      </p>

      <ul
        className="mt-5 min-w-0 space-y-2 text-sm"
      >
        <li className="flex min-w-0 items-start gap-3">
          <BookOpenCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-classroom-success-fg" />
          <span className="min-w-0 break-words">
            <Trans>
              <strong>学习</strong>
              ：按当前主题继续讲解和练习。
            </Trans>
          </span>
        </li>
        <li className="flex min-w-0 items-start gap-3">
          <MessagesSquare aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-tour-accent-fg" />
          <span className="min-w-0 break-words">
            <Trans>
              <strong>侧栏聊天</strong>
              ：随时提问、要例子，或讨论你正在写的代码。
            </Trans>
          </span>
        </li>
        <li className="flex min-w-0 items-start gap-3">
          <GraduationCap aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-classroom-success-fg" />
          <span className="min-w-0 break-words">
            <Trans>
              <strong>进度</strong>
              ：来自已看内容、练习提交和复习检查；聊天答疑不会直接判定掌握。
            </Trans>
          </span>
        </li>
      </ul>

      <div
        className="mt-6 flex min-w-0 flex-wrap items-center gap-3"
      >
        {configReady && !sharedQuotaExhausted
          ? (
              <span
                role="status"
                aria-live="polite"
                aria-atomic="true"
                aria-busy="true"
                className="inline-flex max-w-full items-start gap-2 text-left text-sm leading-6 text-muted-foreground"
              >
                <Loader2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 animate-spin text-tour-accent-fg" />
                <span className="min-w-0 break-words"><Trans>正在准备课堂内容；完成后会显示第一步讲解或练习。</Trans></span>
              </span>
            )
          : (
              <>
                <button
                  type="button"
                  onClick={() => openSettings(true)}
                  data-testid="classroom-welcome-open-settings"
                  aria-describedby={sharedQuotaExhausted ? quotaDescriptionId : configDescriptionId}
                  title={settingsActionTitle}
                  className="inline-flex max-w-full items-center justify-center gap-2 rounded-md bg-classroom-success-fg px-4 py-2 text-left text-sm font-semibold text-white shadow-sm hover:brightness-95"
                >
                  {sharedQuotaExhausted
                    ? <KeyRound aria-hidden="true" className="size-4 shrink-0" />
                    : <Settings2 aria-hidden="true" className="size-4 shrink-0" />}
                  <span className="min-w-0 break-words">
                    {sharedQuotaExhausted ? <Trans>使用自己的 API Key</Trans> : <Trans>配置 AI 服务开始</Trans>}
                  </span>
                </button>
                {sharedQuotaExhausted
                  ? (
                      <span id={quotaDescriptionId} className="max-w-full break-words text-xs leading-6 text-muted-foreground sm:max-w-md">
                        {quotaResetMoment
                          ? (
                              <Trans>
                                共享额度已用完。下次刷新：
                                {quotaResetMoment}
                                ，刷新后会自动开始准备课堂；使用自己的 API Key 可立刻继续。
                              </Trans>
                            )
                          : <Trans>共享额度已用完。刷新后会自动开始准备课堂；使用自己的 API Key 可立刻继续。</Trans>}
                      </span>
                    )
                  : (
                      <span id={configDescriptionId} className="max-w-full break-words text-xs leading-6 text-muted-foreground">
                        <Trans>完成服务地址、API Key 和模型配置后即可开始。</Trans>
                      </span>
                    )}
              </>
            )}
      </div>
    </section>
  )
}
