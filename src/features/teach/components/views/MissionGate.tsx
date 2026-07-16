'use client'

import { Compass, GraduationCap, MessageCircle, Rocket, Smartphone, Sparkles } from 'lucide-react'
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
}

const COLD_STARTS: ColdStart[] = [
  {
    key: 'beginner',
    icon: GraduationCap,
    title: <Trans>编程新手</Trans>,
    desc: <Trans>从零开始系统学仓颉</Trans>,
    prompt: '我是编程新手，想从零开始系统学习仓颉，请帮我一起确定学习目标。',
  },
  {
    key: 'experienced',
    icon: Rocket,
    title: <Trans>有编程经验</Trans>,
    desc: <Trans>带着已有语言基础快速上手</Trans>,
    prompt: '我已有其他语言的编程经验，想快速上手仓颉，请帮我一起确定学习目标。',
  },
  {
    key: 'harmony',
    icon: Smartphone,
    title: <Trans>鸿蒙开发</Trans>,
    desc: <Trans>面向 HarmonyOS 应用开发</Trans>,
    prompt: '我想用仓颉开发鸿蒙（HarmonyOS）应用，请帮我一起确定学习目标。',
  },
  {
    key: 'taste',
    icon: Sparkles,
    title: <Trans>先体验一下</Trans>,
    desc: <Trans>用一个小例子快速感受</Trans>,
    prompt: '先用一个简单的小例子带我快速体验仓颉，再帮我一起确定学习目标。',
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
      className="relative isolate flex flex-col items-center gap-6 overflow-hidden rounded-3xl border border-primary/18 bg-card/88 px-5 py-9 text-center shadow-[0_24px_70px_-48px_rgba(12,91,73,0.55)] sm:px-8 sm:py-11"
    >
      <span aria-hidden="true" className="absolute -top-24 end-[-4rem] -z-10 size-64 rounded-full bg-primary/7 blur-3xl" />
      <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/12">
        <Compass aria-hidden="true" className="size-6" />
      </span>
      <div className="flex max-w-lg flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">
          <Trans>先和老师确定学习目标</Trans>
        </h2>
        <p className="text-pretty text-sm leading-6 text-muted-foreground">
          <Trans>课程会紧扣你的学习目标安排。选一个最贴近你的起点，老师会据此与你确认目标，并安排第一课。</Trans>
        </p>
      </div>

      <div className="grid w-full max-w-xl grid-cols-1 gap-2.5 sm:grid-cols-2">
        {COLD_STARTS.map(({ key, icon: Icon, title, desc, prompt }) => (
          <button
            key={key}
            type="button"
            data-testid={`mission-gate-preset-${key}`}
            onClick={() => prefillChat(prompt)}
            className="group flex min-h-20 items-start gap-3 rounded-2xl border border-border/70 bg-background/72 p-3.5 text-start outline-none transition-[border-color,background-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/5 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring/35 motion-reduce:transform-none"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon aria-hidden="true" className="size-4" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold text-foreground">{title}</span>
              <span className="text-xs leading-5 text-muted-foreground">{desc}</span>
            </span>
          </button>
        ))}
      </div>

      <Button
        type="button"
        variant="ghost"
        data-testid="mission-gate-start"
        onClick={() => prefillChat('我想学习仓颉，请帮我一起确定学习目标。')}
        className="rounded-xl text-sm font-medium text-primary hover:bg-primary/8 hover:text-primary"
      >
        <MessageCircle aria-hidden="true" className="size-4" />
        <Trans>或者，自己向老师描述目标</Trans>
      </Button>
    </div>
  )
}
