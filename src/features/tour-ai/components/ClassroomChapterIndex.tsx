'use client'

import { useMemo } from 'react'
import { BookOpen } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useClassroomSession } from '@/features/tour-ai/context/classroom-session-context'
import { useViewportRef } from '@/features/tour-ai/context/classroom-viewport-context'
import { deriveChapterIndex } from '@/lib/ai/classroom/selectors'
import { classroomFadeUpVariants, classroomStaggerVariants } from '@/features/tour-ai/components/classroom-motion'

export function ClassroomChapterIndex() {
  const { session } = useClassroomSession()
  const viewportRef = useViewportRef()
  const chapters = useMemo(() => deriveChapterIndex(session), [session])

  const scrollTo = (blockKey: string) => {
    const el = viewportRef.current
    if (!el)
      return
    const target = el.querySelector(`[data-chapter-id="${CSS.escape(blockKey)}"]`)
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t`课程目录`}
          disabled={chapters.length === 0}
          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-tour-bg disabled:opacity-40"
        >
          <BookOpen className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-1" align="end">
        <AnimatePresence initial={false} mode="wait">
          {chapters.length === 0
            ? (
                <motion.div
                  key="empty"
                  variants={classroomFadeUpVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="px-3 py-6 text-center text-xs text-muted-foreground"
                >
                  <Trans>尚无章节</Trans>
                </motion.div>
              )
            : (
                <motion.ul
                  key="chapters"
                  variants={classroomStaggerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  className="max-h-80 overflow-auto"
                >
                  {chapters.map(c => (
                    <motion.li key={c.id} variants={classroomFadeUpVariants}>
                      <button
                        type="button"
                        onClick={() => scrollTo(c.blockKey)}
                        className={cn(
                          'w-full truncate rounded px-3 py-1.5 text-left text-sm hover:bg-tour-bg',
                          c.level === 3 && 'pl-6 text-xs',
                        )}
                      >
                        {c.text}
                      </button>
                    </motion.li>
                  ))}
                </motion.ul>
              )}
        </AnimatePresence>
      </PopoverContent>
    </Popover>
  )
}
