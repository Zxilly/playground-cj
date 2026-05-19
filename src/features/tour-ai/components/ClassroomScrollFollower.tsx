'use client'

import { ChevronDown } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { classroomSpring } from '@/features/tour-ai/components/classroom-motion'

interface Props {
  visible: boolean
  onClick: () => void
}

export function ClassroomScrollFollower({ visible, onClick }: Props) {
  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.button
          type="button"
          aria-label={t`滚动到最新内容`}
          onClick={onClick}
          initial={{ opacity: 0, y: 12, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 10, x: '-50%' }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          transition={classroomSpring}
          // bottom-20 keeps the pill above the sticky ClassroomIntentBar
          // (~48px tall, anchored at bottom-3) so the two surfaces don't collide.
          // z-20 puts it above the rail so an accidental click on a marker
          // doesn't intercept the pill.
          className="absolute bottom-20 left-1/2 z-20 inline-flex items-center gap-1.5 rounded-full border border-tour-border bg-tour-surface px-3 py-1.5 text-xs font-medium text-tour-accent-fg shadow-md hover:bg-tour-bg"
        >
          <ChevronDown className="size-3.5" />
          <Trans>新内容</Trans>
        </motion.button>
      )}
    </AnimatePresence>
  )
}
