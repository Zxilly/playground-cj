'use client'

import { BookOpenCheck, MessagesSquare, Settings2, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { Trans } from '@lingui/react/macro'
import { useLLMConfigStore } from '@/stores/llmConfig'
import {
  classroomCardVariants,
  classroomFadeUpVariants,
  classroomStaggerVariants,
} from '@/features/tour-ai/components/classroom-motion'

interface ClassroomWelcomeCardProps {
  /** Whether the LLM API key has been configured. Decides primary CTA copy. */
  hasApiKey: boolean
}

// First-paint card the learner sees in AI Mode. Previously the empty state was
// a single line ("正在规划下一步") — that left a new visitor with no idea what
// the page actually does, whether to wait, click something, or go elsewhere.
// This card replaces it with a value pitch + a clear next step that depends on
// whether the LLM is configured yet.
export function ClassroomWelcomeCard({ hasApiKey }: ClassroomWelcomeCardProps) {
  const openSettings = useLLMConfigStore(state => state.setSettingsDialogOpen)

  return (
    <motion.section
      data-testid="classroom-welcome-card"
      variants={classroomStaggerVariants}
      initial="hidden"
      animate="visible"
      className="rounded-md border border-tour-border bg-tour-surface p-6"
    >
      <motion.div
        variants={classroomFadeUpVariants}
        className="inline-flex items-center gap-2 rounded-full bg-tour-bg px-3 py-1 text-xs font-medium text-tour-link"
      >
        <Sparkles className="size-3.5" />
        <Trans>AI 助教</Trans>
      </motion.div>

      <motion.h2
        variants={classroomFadeUpVariants}
        className="mt-4 text-xl font-bold text-tour-heading"
      >
        <Trans>这不是普通教程，而是一节为你定制的课。</Trans>
      </motion.h2>

      <motion.p
        variants={classroomFadeUpVariants}
        className="mt-2 text-sm leading-7 text-muted-foreground"
      >
        <Trans>
          AI 助教会根据你的进度即时编写讲解、出题，并根据你的答题表现调整节奏。
          你可以随时让它讲慢一点、再深入一些，或者解释你刚才的错误。
        </Trans>
      </motion.p>

      <motion.ul
        variants={classroomStaggerVariants}
        className="mt-5 space-y-2 text-sm"
      >
        <motion.li variants={classroomCardVariants} className="flex items-start gap-3">
          <BookOpenCheck className="mt-0.5 size-4 shrink-0 text-classroom-success-fg" />
          <span>
            <Trans>
              <strong>自适应课程</strong>
              ：按你的答题表现即时编排讲解和练习。
            </Trans>
          </span>
        </motion.li>
        <motion.li variants={classroomCardVariants} className="flex items-start gap-3">
          <MessagesSquare className="mt-0.5 size-4 shrink-0 text-tour-accent-fg" />
          <span>
            <Trans>
              <strong>侧栏聊天</strong>
              ：随时提问、要例子，或讨论你正在写的代码。
            </Trans>
          </span>
        </motion.li>
      </motion.ul>

      <motion.div
        variants={classroomFadeUpVariants}
        className="mt-6 flex flex-wrap items-center gap-3"
      >
        {hasApiKey
          ? (
              <span className="text-sm text-muted-foreground">
                <Trans>正在准备你的开场…</Trans>
              </span>
            )
          : (
              <>
                <button
                  type="button"
                  onClick={() => openSettings(true)}
                  data-testid="classroom-welcome-open-settings"
                  className="inline-flex items-center gap-2 rounded-md bg-classroom-success-fg px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-95"
                >
                  <Settings2 className="size-4" />
                  <Trans>配置 API Key 开始</Trans>
                </button>
                <span className="text-xs text-muted-foreground">
                  <Trans>无需注册，使用你已有的 OpenAI 兼容 API Key 即可。</Trans>
                </span>
              </>
            )}
      </motion.div>
    </motion.section>
  )
}
