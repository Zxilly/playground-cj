'use client'

import { CheckCircle2, Target, X } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import { t } from '@lingui/core/macro'
import { useAIBridge } from '@/components/tour/EditorBridgeContext'
import { useLearnerStore } from '@/stores/learner'

export function QuizBanner() {
  const { uiLang } = useAIBridge()
  const quiz = useLearnerStore(state => state.learner.activeQuiz)
  const setActiveQuiz = useLearnerStore(state => state.setActiveQuiz)
  if (!quiz)
    return null
  const promptText = quiz.prompt[uiLang] || quiz.prompt.zh

  const cancel = () => setActiveQuiz(null)

  return (
    <div className="border-b border-tour-teal/30 bg-tour-teal/5 px-3 py-2 text-xs space-y-1">
      <div className="flex items-center gap-2">
        <Target className="size-3.5 text-tour-teal shrink-0" />
        <span className="font-semibold text-foreground/90">
          <Trans>小测验</Trans>
        </span>
        <span className="text-[10px] text-muted-foreground">
          {`#${quiz.conceptId} · ${t`尝试`} ${quiz.attempts}`}
        </span>
        <button
          onClick={cancel}
          className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={t`放弃当前测验`}
          title={t`放弃当前测验`}
        >
          <X className="size-3" />
        </button>
      </div>
      <div className="text-foreground/80 whitespace-pre-wrap leading-snug">
        {promptText}
      </div>
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <CheckCircle2 className="size-3" />
        <Trans>在编辑器修改代码后点击运行；输出与期望匹配会自动通过。</Trans>
      </div>
    </div>
  )
}
