'use client'

import { useMemo } from 'react'
import { BookOpen } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useClassroomSession } from '@/features/tour-ai/context/classroom-session-context'
import { useViewportRef } from '@/features/tour-ai/context/classroom-viewport-context'
import { deriveChapterIndex } from '@/lib/ai/classroom/selectors'

export function ClassroomChapterIndex() {
  const { session } = useClassroomSession()
  const viewportRef = useViewportRef()
  const chapters = useMemo(() => deriveChapterIndex(session), [session])

  const scrollTo = (blockKey: string) => {
    const el = viewportRef.current
    if (!el)
      return
    const target = el.querySelector(`[data-chapter-key="${CSS.escape(blockKey)}"]`)
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
        {chapters.length === 0
          ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                <Trans>尚无章节</Trans>
              </div>
            )
          : (
              <ul className="max-h-80 overflow-auto">
                {chapters.map(c => (
                  <li key={c.id}>
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
                  </li>
                ))}
              </ul>
            )}
      </PopoverContent>
    </Popover>
  )
}
