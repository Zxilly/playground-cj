'use client'

import { Compass, GraduationCap, MessageCircle, Rocket, Smartphone, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import type { ReactNode } from 'react'
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
      className="flex flex-col items-center gap-5 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-6 py-10 text-center"
    >
      <Compass aria-hidden="true" className="size-8 text-primary" />
      <div className="flex max-w-md flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">
          <Trans>先和老师确定学习目标</Trans>
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          <Trans>课程会紧扣你的学习目标安排。选一个最贴近你的起点，老师会据此与你确认目标，并安排第一课。</Trans>
        </p>
      </div>

      <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
        {COLD_STARTS.map(({ key, icon: Icon, title, desc, prompt }) => (
          <button
            key={key}
            type="button"
            data-testid={`mission-gate-preset-${key}`}
            onClick={() => prefillChat(prompt)}
            className="group flex items-start gap-3 rounded-lg border border-border/60 bg-background/60 p-3 text-start transition-colors hover:border-primary/50 hover:bg-primary/5"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon aria-hidden="true" className="size-4" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold text-foreground">{title}</span>
              <span className="text-xs leading-5 text-muted-foreground">{desc}</span>
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        data-testid="mission-gate-start"
        onClick={() => prefillChat('我想学习仓颉，请帮我一起确定学习目标。')}
        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <MessageCircle aria-hidden="true" className="size-4" />
        <Trans>或者，自己向老师描述目标</Trans>
      </button>
    </div>
  )
}
