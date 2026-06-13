'use client'

import { MessageCircleQuestion } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import type { FollowupPromptBlockProps } from './block-props'
import { useLessonNavigation } from '@/features/teach/context/useLessonNavigation'

/**
 * Collateral block: a reminder (teach hard rule) nudging the learner to ask the
 * teacher a follow-up question. The "ask the teacher" button seeds the chat
 * composer with the prompt via the workspace navigation context (`prefillChat`)
 * so the learner can send or edit it.
 */
export function FollowupPromptBlock({ block }: FollowupPromptBlockProps) {
  const { prefillChat } = useLessonNavigation()
  return (
    <section
      data-testid="followup-prompt-block"
      className="flex flex-col gap-2 rounded-md border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-2">
        <MessageCircleQuestion aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="min-w-0 text-sm leading-6 text-foreground">{block.prompt}</p>
      </div>
      <button
        type="button"
        data-testid="followup-ask"
        onClick={() => prefillChat(block.prompt)}
        className="inline-flex shrink-0 items-center justify-center rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-95"
      >
        <Trans>问老师</Trans>
      </button>
    </section>
  )
}
