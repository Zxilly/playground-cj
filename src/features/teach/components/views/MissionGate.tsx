'use client'

import { ArrowUpRight, Compass, GraduationCap, MessageCircle, Rocket, Smartphone, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { useLessonNavigation } from '@/features/teach/context/useLessonNavigation'

/**
 * Cold-start presets shown on the empty workspace. Each seeds the teacher chat
 * with a concrete opening so the learner does not face a blank "talk to the
 * teacher" prompt — they pick the starting point closest to them and the teacher
 * runs the mission interview from there. The `prompt` text is the message dropped
 * into the composer (kept literal, matching the rest of the gate's openings).
 */
interface ColdStart {
  key: string
  icon: LucideIcon
  title: ReactNode
  desc: ReactNode
  prompt: string
  iconClassName: string
}

const COLD_STARTS: ColdStart[] = [
  {
    key: 'beginner',
    icon: GraduationCap,
    title: <Trans>编程新手</Trans>,
    desc: <Trans>从零开始系统学仓颉</Trans>,
    prompt: '我是编程新手，想从零开始系统学习仓颉，请帮我一起确定学习目标。',
    iconClassName: 'border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/45 dark:text-emerald-300',
  },
  {
    key: 'experienced',
    icon: Rocket,
    title: <Trans>有编程经验</Trans>,
    desc: <Trans>带着已有语言基础快速上手</Trans>,
    prompt: '我已有其他语言的编程经验，想快速上手仓颉，请帮我一起确定学习目标。',
    iconClassName: 'border-sky-200/80 bg-sky-50 text-sky-700 dark:border-sky-800/70 dark:bg-sky-950/45 dark:text-sky-300',
  },
  {
    key: 'harmony',
    icon: Smartphone,
    title: <Trans>鸿蒙开发</Trans>,
    desc: <Trans>面向 HarmonyOS 应用开发</Trans>,
    prompt: '我想用仓颉开发鸿蒙（HarmonyOS）应用，请帮我一起确定学习目标。',
    iconClassName: 'border-violet-200/80 bg-violet-50 text-violet-700 dark:border-violet-800/70 dark:bg-violet-950/45 dark:text-violet-300',
  },
  {
    key: 'taste',
    icon: Sparkles,
    title: <Trans>先体验一下</Trans>,
    desc: <Trans>用一个小例子快速感受</Trans>,
    prompt: '先用一个简单的小例子带我快速体验仓颉，再帮我一起确定学习目标。',
    iconClassName: 'border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/45 dark:text-amber-300',
  },
]

/**
 * Mission-first gate shown in the central viewport whenever the workspace has no
 * mission yet. Lessons are grounded in the learner's *why*, so the teacher never
 * authors a lesson before a mission exists — and the UI mirrors that: the lessons
 * surface is replaced by this guidance and the lessons nav entry is disabled
 * (see {@link TeachWorkspaceShell}).
 *
 * Instead of a single generic "talk to the teacher" button, the gate offers a few
 * cold-start presets: each seeds the chat composer with a tailored opening (via
 * the lesson-navigation context's `prefillChat`, the same channel `followup_prompt`
 * blocks use) so the learner gets moving immediately. A plain "describe it myself"
 * link keeps the open-ended path.
 */
export function MissionGate() {
  const { prefillChat } = useLessonNavigation()
  return (
    <div
      data-testid="mission-gate"
      className="flex flex-col items-center gap-7 px-5 py-8 text-center sm:px-8 sm:py-10"
    >
      <span className="grid size-14 place-items-center rounded-2xl border border-primary/15 bg-primary/8 text-primary shadow-sm ring-4 ring-primary/5">
        <Compass aria-hidden="true" className="size-7" />
      </span>
      <div className="flex max-w-xl flex-col gap-2.5">
        <h2 className="text-2xl font-semibold tracking-[-0.03em] text-foreground">
          <Trans>先和老师确定学习目标</Trans>
        </h2>
        <p className="text-pretty text-sm leading-6 text-muted-foreground sm:text-[0.9375rem]">
          <Trans>课程会紧扣你的学习目标安排。选一个最贴近你的起点，老师会据此与你确认目标，并安排第一课。</Trans>
        </p>
      </div>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        {COLD_STARTS.map(({ key, icon: Icon, title, desc, prompt, iconClassName }) => (
          <button
            key={key}
            type="button"
            data-testid={`mission-gate-preset-${key}`}
            onClick={() => prefillChat(prompt)}
            className="group relative flex min-h-28 items-start gap-4 overflow-hidden rounded-xl border border-border/80 bg-background p-4 text-start shadow-[0_1px_2px_rgba(15,23,42,0.03)] outline-none transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/[0.025] hover:shadow-[0_14px_34px_-22px_rgba(42,122,110,0.65)] active:translate-y-0 active:shadow-sm focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-ring/35"
          >
            <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl border ${iconClassName}`}>
              <Icon aria-hidden="true" className="size-5" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1 pe-6 pt-0.5">
              <span className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-foreground">{title}</span>
              <span className="text-[0.8125rem] leading-5 text-muted-foreground">{desc}</span>
            </span>
            <span className="absolute end-3.5 top-3.5 flex size-7 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground transition-[color,border-color,transform] duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:text-primary">
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </span>
          </button>
        ))}
      </div>

      <Button
        type="button"
        variant="ghost"
        data-testid="mission-gate-start"
        onClick={() => prefillChat('我想学习仓颉，请帮我一起确定学习目标。')}
        className="h-10 rounded-full border border-border/70 bg-background px-4 text-sm font-medium text-primary shadow-xs hover:border-primary/25 hover:bg-primary/5 hover:text-primary"
      >
        <MessageCircle aria-hidden="true" className="size-4.5" />
        <Trans>或者，自己向老师描述目标</Trans>
      </Button>
    </div>
  )
}
