'use client'

import { ArrowRight, BookOpenCheck, Code2, Sparkles, Target } from 'lucide-react'
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

      <main className="teach-ambient min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid min-h-full w-full max-w-7xl grid-cols-1 lg:grid-cols-[minmax(0,1.12fr)_minmax(21rem,0.88fr)]">
          <section className="flex min-w-0 items-center px-6 py-12 sm:px-10 lg:min-h-0 lg:px-14 lg:py-16 xl:px-20">
            <div className="min-w-0 max-w-3xl">
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-1.5 text-xs font-semibold text-primary shadow-sm">
                <Sparkles aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="min-w-0 break-words"><Trans>AI 课堂</Trans></span>
              </div>
              <h1 className="mt-6 max-w-3xl text-balance break-words text-3xl font-bold leading-[1.12] tracking-[-0.03em] text-foreground sm:text-4xl lg:text-5xl xl:text-[3.4rem]">
                <Trans>依据你的目标定制仓颉课程</Trans>
              </h1>
              <p className="mt-6 max-w-2xl text-pretty break-words text-base leading-8 text-muted-foreground sm:text-[1.05rem]">
                <Trans>
                  先与课堂明确你的学习目的与预期成果，课堂将据此安排课程、练习与复习。整个工作区即一份可导出的文件，进度始终保存在本机。
                </Trans>
              </p>

              <div className="mt-9 flex min-w-0 flex-wrap items-center gap-3">
                <Button
                  type="button"
                  size="lg"
                  onClick={onStart}
                  data-testid="teach-landing-start"
                  className="h-11 max-w-full rounded-xl px-6 font-semibold shadow-[0_10px_28px_-12px_rgba(15,107,91,0.45)]"
                >
                  <span className="min-w-0 break-words"><Trans>开始</Trans></span>
                  <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
                </Button>
              </div>
            </div>
          </section>

          <aside className="flex min-w-0 items-center border-t border-border/60 bg-card/45 px-6 py-10 backdrop-blur-sm sm:px-10 lg:border-l lg:border-t-0 lg:px-10 xl:px-12">
            <div className="w-full space-y-3">
              <LandingFeature index="01" icon={Target} title={<Trans>目标优先</Trans>}>
                <Trans>先明确你希望用仓颉实现的目标，课堂据此安排课程，而非套用固定大纲。</Trans>
              </LandingFeature>
              <LandingFeature index="02" icon={Code2} title={<Trans>动手练习</Trans>}>
                <Trans>在内置编辑器中编写仓颉代码并直接运行查看结果，课堂据此给出反馈。</Trans>
              </LandingFeature>
              <LandingFeature index="03" icon={BookOpenCheck} title={<Trans>复习巩固</Trans>}>
                <Trans>依据记忆曲线安排复习，帮助你长期留存所学内容。</Trans>
              </LandingFeature>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}

interface LandingFeatureProps {
  children: React.ReactNode
  icon: typeof Target
  index: string
  title: React.ReactNode
}

function LandingFeature({ children, icon: Icon, index, title }: LandingFeatureProps) {
  return (
    <section className="group min-w-0 rounded-2xl border border-border/70 bg-card/88 p-4 shadow-[0_12px_35px_-28px_rgba(20,45,37,0.45)] transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_18px_38px_-26px_rgba(20,91,74,0.4)] motion-reduce:transform-none">
      <div className="flex min-w-0 items-start gap-3.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10">
          <Icon aria-hidden="true" className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h2 className="min-w-0 break-words text-sm font-semibold text-foreground">{title}</h2>
            <span aria-hidden="true" className="font-mono text-[10px] font-semibold tracking-widest text-muted-foreground/55">{index}</span>
          </div>
          <p className="mt-1.5 break-words text-sm leading-6 text-muted-foreground">{children}</p>
        </div>
      </div>
    </section>
  )
}
