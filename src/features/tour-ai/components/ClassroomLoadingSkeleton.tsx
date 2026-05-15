'use client'

import { t } from '@lingui/core/macro'
import { motion } from 'framer-motion'
import { classroomFadeUpVariants, classroomStaggerVariants } from '@/features/tour-ai/components/classroom-motion'

const skeletonLineClasses = [
  'h-4 w-full animate-shimmer rounded bg-tour-border-soft',
  'h-4 w-11/12 animate-shimmer rounded bg-tour-border-soft',
  'h-4 w-9/12 animate-shimmer rounded bg-tour-border-soft',
]

export function ClassroomLoadingSkeleton() {
  return (
    <motion.div
      role="status"
      aria-busy="true"
      aria-label={t`正在加载课程内容`}
      variants={classroomStaggerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-5"
    >
      <motion.div variants={classroomFadeUpVariants} className="h-6 w-48 animate-shimmer rounded bg-tour-border-soft" />
      <motion.div variants={classroomStaggerVariants} className="space-y-2">
        {skeletonLineClasses.map(className => (
          <motion.div key={className} variants={classroomFadeUpVariants} className={className} />
        ))}
      </motion.div>
      <motion.div variants={classroomFadeUpVariants} className="h-32 w-full animate-shimmer rounded-md bg-tour-border-soft" />
      <motion.div variants={classroomFadeUpVariants} className="h-4 w-full animate-shimmer rounded bg-tour-border-soft" />
    </motion.div>
  )
}
