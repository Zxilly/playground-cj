'use client'

import { useEffect, useId, useState } from 'react'
import dynamic from 'next/dynamic'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { ClassroomBrandChip } from '@/features/tour-ai/components/ClassroomBrandChip'
import { cn } from '@/lib/utils'
import { currentAIClassroomHref, currentStaticTourRecoveryHref } from './classroom-loading-recovery'

const AI_CLASSROOM_LOADING_RECOVERY_DELAY_MS = 6000

export function AIClassroomLoadingShell() {
  const [showRecovery, setShowRecovery] = useState(false)
  const pageTitleId = useId()
  const statusTitleId = useId()
  const statusDetailId = useId()
  const recoveryDetailId = useId()
  const recoveryHref = currentAIClassroomHref()
  const staticTourRecoveryHref = currentStaticTourRecoveryHref()
  const statusTitle = t`正在恢复课堂环境`
  const staticTourTitle = t`打开当前概念对应的静态教程内容，不会改变 AI 课堂进度。`

  useEffect(() => {
    const timeout = window.setTimeout(setShowRecovery, AI_CLASSROOM_LOADING_RECOVERY_DELAY_MS, true)
    return () => window.clearTimeout(timeout)
  }, [])

  return (
    <div className="ai-classroom-root ai-classroom-viewport-root bg-tour-bg text-tour-text">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-tour-border bg-tour-surface px-5">
        <div className="flex min-w-0 items-center gap-3">
          <ClassroomBrandChip />
        </div>
      </header>
      <main aria-labelledby={pageTitleId} className="mx-auto w-full max-w-[920px] px-6 py-8 pb-20">
        <div className="text-xs font-semibold uppercase text-tour-link"><Trans>课堂内容</Trans></div>
        <h1 id={pageTitleId} className="mt-1 text-2xl font-bold tracking-normal text-tour-heading"><Trans>AI 课堂</Trans></h1>
        <section
          role="region"
          aria-labelledby={statusTitleId}
          aria-describedby={showRecovery ? `${statusDetailId} ${recoveryDetailId}` : statusDetailId}
          aria-busy="true"
          data-testid="ai-classroom-loading-shell"
          className={cn('rounded-md border border-tour-border bg-tour-surface px-4 py-4 text-sm text-muted-foreground', 'mt-6')}
        >
          <div
            role="status"
            aria-labelledby={statusTitleId}
            aria-describedby={statusDetailId}
            aria-live="polite"
            aria-atomic="true"
          >
            <div id={statusTitleId} className="font-medium text-tour-heading">{statusTitle}</div>
            <p id={statusDetailId} className="mt-2 text-xs leading-6">
              <Trans>正在加载编辑器、语言服务和你的课堂进度，通常只需要几秒。</Trans>
            </p>
          </div>
          {showRecovery && (
            <div className="mt-3 border-t border-tour-border pt-3 text-xs leading-6">
              <p id={recoveryDetailId}>
                <Trans>如果仍然停留在这里，可以刷新页面，或回到对应教程后再进入 AI 课堂。</Trans>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={recoveryHref}
                  aria-describedby={recoveryDetailId}
                  title={t`刷新当前 AI 课堂页面；已保存的课堂进度会继续用于恢复。`}
                  className="inline-flex max-w-full rounded-md border border-tour-border bg-tour-bg px-3 py-1.5 text-xs font-semibold text-tour-heading hover:bg-tour-surface"
                >
                  <Trans>刷新页面</Trans>
                </a>
                {staticTourRecoveryHref && (
                  <a
                    href={staticTourRecoveryHref}
                    aria-describedby={recoveryDetailId}
                    title={staticTourTitle}
                    className="inline-flex max-w-full rounded-md border border-tour-border bg-tour-bg px-3 py-1.5 text-xs font-semibold text-tour-heading hover:bg-tour-surface"
                  >
                    <Trans>查看对应教程</Trans>
                  </a>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

const TourAIApp = dynamic(
  () => import('./TourAIApp'),
  {
    ssr: false,
    loading: AIClassroomLoadingShell,
  },
)

interface TourAIWrapperProps {
  lang: string
}

export default function TourAIWrapper(props: TourAIWrapperProps) {
  // The landing screen does not need Monaco's VS Code language pack. Keeping
  // that import out of this wrapper prevents editor localization assets from
  // blocking the AI Classroom entry point.
  return <TourAIApp lang={props.lang} />
}
