'use client'

import { useCallback, useMemo } from 'react'
import { ChevronsRight, HelpCircle, Telescope, Turtle } from 'lucide-react'
import { motion } from 'framer-motion'
import { t } from '@lingui/core/macro'
import type { ClassroomAction } from '@/lib/ai/classroom/reducer'
import type { ChatIntentKind, ClassroomSession } from '@/lib/ai/classroom/types'
import { useLLMConfig, useLLMConfigStore } from '@/stores/llmConfig'
import { cn } from '@/lib/utils'
import { classroomFadeUpVariants } from '@/features/tour-ai/components/classroom-motion'

interface ClassroomIntentBarProps {
  session: ClassroomSession
  dispatch: React.Dispatch<ClassroomAction>
  disabled: boolean
}

interface IntentChoice {
  intent: ChatIntentKind
  label: string
  summary: string
  icon: React.ReactNode
  tone: 'neutral' | 'help'
}

// Intent options surfaced as one-tap buttons. We deliberately drop
// `change_topic` from the bar — switching topics mid-session is high friction
// and is better expressed as free-form chat ("I'd rather learn X next") than as
// an always-visible button.
function useIntentChoices(): IntentChoice[] {
  return useMemo(() => [
    {
      intent: 'advance',
      label: t`我懂了，继续`,
      summary: t`Learner is comfortable with the current content and wants to advance to the next teaching step.`,
      icon: <ChevronsRight className="size-4" />,
      tone: 'neutral',
    },
    {
      intent: 'go_deeper',
      label: t`再深入讲讲`,
      summary: t`Learner wants a deeper explanation or more advanced examples of the current topic before moving on.`,
      icon: <Telescope className="size-4" />,
      tone: 'neutral',
    },
    {
      intent: 'slow_down',
      label: t`讲慢一点`,
      summary: t`Learner wants the explanation slowed down with smaller steps and more elementary examples.`,
      icon: <Turtle className="size-4" />,
      tone: 'neutral',
    },
    {
      intent: 'explain_error',
      label: t`帮我看看错在哪`,
      summary: t`Learner needs help understanding their recent mistake or why their code does not behave as expected.`,
      icon: <HelpCircle className="size-4" />,
      tone: 'help',
    },
  ], [])
}

export function ClassroomIntentBar({ session, dispatch, disabled }: ClassroomIntentBarProps) {
  const choices = useIntentChoices()
  const config = useLLMConfig()
  const openSettings = useLLMConfigStore(state => state.setSettingsDialogOpen)
  const hasApiKey = Boolean(config.apiKey)
  const effectiveDisabled = disabled || !hasApiKey

  const onClick = useCallback((choice: IntentChoice) => {
    // Clicking an intent without an API key would only queue an event that
    // never runs. Take them straight to settings instead of leaving the
    // request silently stuck.
    if (!hasApiKey) {
      openSettings(true)
      return
    }
    dispatch({
      type: 'EMIT_CHAT_INTENT',
      intent: choice.intent,
      summary: choice.summary,
      now: Date.now(),
    })
  }, [dispatch, hasApiKey, openSettings])

  // Hide on the truly-empty state — the welcome card owns onboarding then.
  if (session.stream.length === 0)
    return null

  return (
    <motion.div
      data-testid="classroom-intent-bar"
      variants={classroomFadeUpVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        'pointer-events-none sticky bottom-3 z-10 mx-auto mt-6 flex w-full max-w-3xl justify-center px-2',
      )}
    >
      <div
        className={cn(
          'pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-full border border-tour-border bg-tour-surface/95 px-2 py-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.08)] backdrop-blur',
        )}
        role="group"
        aria-label={t`告诉 AI 你的下一步`}
      >
        {choices.map(choice => (
          <button
            key={choice.intent}
            type="button"
            disabled={effectiveDisabled && hasApiKey}
            data-testid={`classroom-intent-${choice.intent}`}
            title={!hasApiKey ? t`需要先配置 API Key` : undefined}
            onClick={() => onClick(choice)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              'text-tour-text hover:bg-tour-bg disabled:cursor-not-allowed disabled:opacity-40',
              !hasApiKey && 'opacity-70',
              choice.tone === 'help' && 'text-classroom-warning-fg hover:bg-classroom-warning-bg',
            )}
          >
            {choice.icon}
            <span>{choice.label}</span>
          </button>
        ))}
      </div>
    </motion.div>
  )
}
