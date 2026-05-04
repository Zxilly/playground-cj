'use client'

import { Sparkles, X } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import { t } from '@lingui/core/macro'
import { useLearnerStore } from '@/stores/learner'
import type { QuizMatchMode } from '@/lib/ai/learner-model'

const MATCH_MODE_LABELS: Record<QuizMatchMode, () => string> = {
  exact: () => t`精确匹配`,
  contains: () => t`包含匹配`,
  regex: () => t`正则匹配`,
}

export function QuizPanel() {
  const quiz = useLearnerStore(state => state.learner.activeQuiz)
  const setActiveQuiz = useLearnerStore(state => state.setActiveQuiz)
  if (!quiz)
    return null
  const matchModeLabel = MATCH_MODE_LABELS[quiz.matchMode]()

  const cancel = () => setActiveQuiz(null)

  return (
    <section
      className="flex items-center gap-2 border-b border-tour-teal/40 bg-gradient-to-r from-tour-teal/15 via-tour-teal/8 to-transparent px-3 py-2 text-xs"
      aria-label={t`小测验`}
    >
      <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-tour-teal/20 text-tour-teal">
        <Sparkles className="size-3" />
      </span>
      <div className="flex flex-1 min-w-0 flex-col leading-tight">
        <span className="font-semibold text-foreground/95">
          <Trans>小测验进行中</Trans>
        </span>
        <span className="text-[10px] text-muted-foreground truncate">
          {`#${quiz.conceptId} · ${t`尝试`} ${quiz.attempts} · ${matchModeLabel} · ${t`详情见右侧测试面板`}`}
        </span>
      </div>
      <button
        type="button"
        onClick={cancel}
        className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        aria-label={t`放弃当前测验`}
        title={t`放弃当前测验`}
      >
        <X className="size-3" />
        <span className="hidden sm:inline"><Trans>放弃</Trans></span>
      </button>
    </section>
  )
}
