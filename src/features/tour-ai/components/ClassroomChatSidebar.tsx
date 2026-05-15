'use client'

import { X } from 'lucide-react'
import { motion } from 'framer-motion'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { TourAIChat } from '@/features/tour-ai/components/TourAIChat'
import { classroomDrawerVariants, classroomOverlayVariants } from '@/features/tour-ai/components/classroom-motion'

export function ClassroomChatSidebar({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      <motion.button
        type="button"
        aria-label={t`关闭聊天浮层`}
        data-testid="classroom-chat-overlay"
        className="absolute inset-0 bg-black/20 pointer-events-auto"
        variants={classroomOverlayVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={onClose}
      />
      <motion.aside
        data-testid="classroom-chat-sidebar"
        className="fixed inset-y-0 right-0 z-10 flex h-full w-full max-w-[390px] shrink-0 flex-col border-l border-tour-border bg-tour-surface shadow-[-12px_0_32px_rgba(31,27,22,.12)] pointer-events-auto dark:shadow-[-12px_0_32px_rgba(0,0,0,.4)]"
        variants={classroomDrawerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-tour-border px-4">
          <div className="text-sm font-semibold text-tour-text"><Trans>聊天</Trans></div>
          <button
            type="button"
            aria-label={t`关闭聊天`}
            onClick={onClose}
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-tour-bg"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <TourAIChat />
        </div>
      </motion.aside>
    </div>
  )
}
