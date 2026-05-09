'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Play, SkipForward } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import { TourEditor } from '@/features/tour/components/TourEditor'
import type { ClassroomAction } from '@/lib/ai/classroom/reducer'
import type { ClassroomQuiz, RunResult } from '@/lib/ai/classroom/types'
import { requestRemoteAction } from '@/service/run'
import { aiClassroomStyles } from '@/features/tour-ai/styles/ai-classroom-design'
import { richTextPlainText } from '@/features/tour-ai/utils/classroom-text'
import { useClassroomActivity } from '@/features/tour-ai/context/classroom-activity-context'

interface QuizPracticeCardProps {
  quiz: ClassroomQuiz
  isActive: boolean
  lang: string
  dispatch: React.Dispatch<ClassroomAction>
  bridge: AIClassroomBridgeValue
}

export function QuizPracticeCard({
  quiz,
  isActive,
  lang,
  dispatch,
  bridge,
}: QuizPracticeCardProps) {
  const [running, setRunning] = useState(false)
  const { setRunnerRunning } = useClassroomActivity()
  const mountedRef = useRef(true)
  const promptText = richTextPlainText(quiz.prompt)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const runQuiz = async () => {
    setRunning(true)
    setRunnerRunning(true)
    try {
      const editorCode = bridge.editor.getEditor()?.getModel()?.getValue() ?? quiz.starterCode
      const data = await requestRemoteAction(editorCode, 'run')
      const result: RunResult = {
        ok: data.compiler_code === 0 && data.bin_code === 0,
        stdout: data.bin_output,
        stderr: data.compiler_output,
        exitCode: data.bin_code,
      }
      if (!mountedRef.current)
        return
      dispatch({ type: 'QUIZ_RUN_FINISHED', result, now: Date.now() })
    }
    catch (error) {
      if (!mountedRef.current)
        return
      dispatch({
        type: 'QUIZ_RUN_FINISHED',
        result: {
          ok: false,
          stdout: '',
          stderr: error instanceof Error ? error.message : String(error),
          exitCode: null,
        },
        now: Date.now(),
      })
    }
    finally {
      if (mountedRef.current)
        setRunning(false)
      setRunnerRunning(false)
    }
  }

  return (
    <section data-testid="quiz-practice-card" className={aiClassroomStyles.surface.accent}>
      <div className={aiClassroomStyles.quiz.header}>
        <div>
          <div className={aiClassroomStyles.text.label}><Trans>Practice</Trans></div>
          <div className={aiClassroomStyles.text.status}>
            <Trans>Quiz</Trans>
            {' '}
            {quiz.status}
          </div>
        </div>
        <div className={aiClassroomStyles.badge.status}>
          <Trans>Quiz</Trans>
          {' '}
          {quiz.status}
        </div>
      </div>
      <div className={aiClassroomStyles.quiz.body}>
        <p className={aiClassroomStyles.text.body}>{promptText}</p>
        <div className={aiClassroomStyles.quiz.expectedFrame}>
          <div className={aiClassroomStyles.quiz.expectedBar}>
            <Trans>Expected output:</Trans>
            {' '}
            <code>{quiz.expectedOutput}</code>
          </div>
          <div className={aiClassroomStyles.quiz.editor}>
            <TourEditor code={quiz.starterCode} locale={lang} />
          </div>
        </div>
        <div className={aiClassroomStyles.quiz.actions}>
          <button
            type="button"
            onClick={runQuiz}
            disabled={running || !isActive}
            className={aiClassroomStyles.button.primary}
          >
            {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            <Trans>运行检查</Trans>
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'QUIZ_SKIP', now: Date.now() })}
            disabled={!isActive}
            className={aiClassroomStyles.button.secondaryLarge}
          >
            <SkipForward className="size-4" />
            <Trans>Skip</Trans>
          </button>
        </div>
      </div>
    </section>
  )
}
