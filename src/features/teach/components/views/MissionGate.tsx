'use client'

import { Compass, MessageCircle } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import { useLessonNavigation } from '@/features/teach/context/useLessonNavigation'

/**
 * Mission-first gate shown in the central viewport whenever the workspace has no
 * mission yet. Lessons are grounded in the learner's *why*, so the teacher never
 * authors a lesson before a mission exists — and the UI mirrors that: the lessons
 * surface is replaced by this guidance and the lessons nav entry is disabled
 * (see {@link TeachWorkspaceShell}).
 *
 * The "和老师聊聊" button seeds the chat composer with an opening so the learner
 * can start the mission interview right away (via the lesson-navigation context's
 * `prefillChat`, the same channel `followup_prompt` blocks use).
 */
export function MissionGate() {
  const { prefillChat } = useLessonNavigation()
  return (
    <div
      data-testid="mission-gate"
      className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-6 py-12 text-center"
    >
      <Compass aria-hidden="true" className="size-8 text-primary" />
      <div className="flex max-w-md flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">
          <Trans>先和老师确定学习目标</Trans>
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          <Trans>
            课程会紧扣你学仓颉的目标来安排。先在右侧和老师聊聊你为什么想学、想做出什么，把学习目标定下来，老师才会据此安排第一课。
          </Trans>
        </p>
      </div>
      <button
        type="button"
        data-testid="mission-gate-start"
        onClick={() => prefillChat('我想学仓颉，帮我一起把学习目标定下来。')}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-95"
      >
        <MessageCircle aria-hidden="true" className="size-4" />
        <Trans>和老师聊聊</Trans>
      </button>
    </div>
  )
}
