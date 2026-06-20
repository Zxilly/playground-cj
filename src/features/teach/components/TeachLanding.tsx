'use client'

import { ArrowRight, BookOpenCheck, Code2, GraduationCap, Sparkles, Target } from 'lucide-react'
import { Trans } from '@lingui/react/macro'

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
      <header className="flex h-12 shrink-0 items-center border-b border-border/60 px-5">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <GraduationCap aria-hidden="true" className="size-4 text-primary" />
          <Trans>课堂</Trans>
        </span>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="flex min-w-0 items-center px-6 py-10 lg:min-h-0 lg:px-14">
          <div className="min-w-0 max-w-3xl">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="min-w-0 break-words"><Trans>AI 课堂</Trans></span>
            </div>
            <h1 className="mt-5 break-words text-4xl font-bold tracking-normal text-foreground md:text-5xl">
              <Trans>依据你的目标定制仓颉课程</Trans>
            </h1>
            <p className="mt-5 max-w-2xl break-words text-base leading-8 text-muted-foreground">
              <Trans>
                先与课堂明确你的学习目的与预期成果，课堂将据此安排课程、练习与复习。整个工作区即一份可导出的文件，进度始终保存在本机。
              </Trans>
            </p>

            <div className="mt-8 flex min-w-0 flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onStart}
                data-testid="teach-landing-start"
                className="inline-flex max-w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-left text-sm font-semibold text-primary-foreground shadow-sm hover:brightness-95"
              >
                <span className="min-w-0 break-words"><Trans>开始</Trans></span>
                <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
              </button>
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
                <Trans>先明确你希望用仓颉实现的目标，课堂据此安排课程，而非套用固定大纲。</Trans>
              </p>
            </section>
            <section className="min-w-0 rounded-md border border-border/60 bg-background p-4">
              <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
                <Code2 aria-hidden="true" className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 break-words"><Trans>动手练习</Trans></span>
              </div>
              <p className="mt-2 break-words text-sm leading-7 text-muted-foreground">
                <Trans>在内置编辑器中编写仓颉代码并直接运行查看结果，课堂据此给出反馈。</Trans>
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
