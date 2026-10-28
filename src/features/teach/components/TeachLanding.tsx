'use client'

import { ArrowRight } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import { Button } from '@/components/ui/button'
import { TeachTopBar } from './TeachTopBar'

export interface TeachLandingProps {
  /** Advance to the AI-source configuration step. */
  onStart: () => void
}

/**
 * Intro landing page shown first, before the {@link TeachConfigWizard} and the
 * workspace. It introduces the classroom and its goal-first / hands-on / review
 * approach; "开始" advances to the configuration step. It holds no LLM-config
 * state — picking and validating an AI source is the wizard's job.
 */
export function TeachLanding({ onStart }: TeachLandingProps) {
  return (
    <div
      data-testid="teach-landing"
      className="flex h-full min-h-0 flex-col bg-background text-foreground"
    >
      <TeachTopBar />

      <div className="min-h-0 flex-1 overflow-y-auto bg-background">
        <div className="mx-auto grid min-h-full w-full max-w-7xl grid-cols-1 border-x border-border lg:grid-cols-[minmax(0,1.12fr)_minmax(21rem,0.88fr)]">
          <section className="flex min-w-0 items-center px-6 py-12 sm:px-10 lg:min-h-0 lg:px-14 lg:py-14 xl:px-16">
            <div className="min-w-0 max-w-3xl">
              <h1 className="max-w-3xl text-balance break-words text-3xl font-bold leading-[1.15] tracking-[-0.02em] text-foreground sm:text-4xl lg:text-5xl">
                <Trans>围绕你的目标学习仓颉基础</Trans>
              </h1>
              <p className="mt-5 max-w-2xl text-pretty break-words text-base leading-7 text-muted-foreground sm:text-[1.05rem]">
                <Trans>
                  选择内置课程并设置学习目标，课堂会据此调整讲解、示例与练习。进度保存在本机，工作区可导出。
                </Trans>
              </p>

              <div className="mt-8 flex min-w-0 flex-wrap items-center gap-3">
                <Button
                  type="button"
                  size="lg"
                  onClick={onStart}
                  data-testid="teach-landing-start"
                  className="min-h-11 max-w-full rounded-md px-5 font-semibold lg:min-h-10"
                >
                  <span className="min-w-0 break-words"><Trans>开始</Trans></span>
                  <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
                </Button>
              </div>
            </div>
          </section>

          <aside className="flex min-w-0 items-center border-t border-border bg-muted px-6 py-9 sm:px-10 lg:border-l lg:border-t-0 lg:px-10 xl:px-12">
            <div className="w-full">
              <LandingFeature title={<Trans>按目标学习</Trans>}>
                <Trans>在所选课程范围内，按你的目标调整讲解、示例和练习。</Trans>
              </LandingFeature>
              <LandingFeature title={<Trans>动手练习</Trans>}>
                <Trans>在内置编辑器中编写仓颉代码并直接运行查看结果，课堂据此给出反馈。</Trans>
              </LandingFeature>
              <LandingFeature title={<Trans>复习巩固</Trans>}>
                <Trans>按概念复习课程，并回顾已保存的讲解与错题诊断。</Trans>
              </LandingFeature>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

interface LandingFeatureProps {
  children: React.ReactNode
  title: React.ReactNode
}

function LandingFeature({ children, title }: LandingFeatureProps) {
  return (
    <section className="min-w-0 border-t border-border py-5 first:border-t-0">
      <h2 className="break-words text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-1.5 break-words text-sm leading-6 text-muted-foreground">{children}</p>
    </section>
  )
}
