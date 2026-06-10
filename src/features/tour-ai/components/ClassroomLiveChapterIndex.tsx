'use client'

import { useId, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useClassroomLiveScrollSurface } from '@/features/tour-ai/context/classroom-live-scroll-surface'
import { cn } from '@/lib/utils'

export function ClassroomLiveChapterIndex() {
  const { chapterEntries: chapters, scrollToBlockKey } = useClassroomLiveScrollSurface()
  const [open, setOpen] = useState(false)
  const [jumpedChapterText, setJumpedChapterText] = useState<string | null>(null)
  const triggerDescriptionId = useId()
  const contentTitleId = useId()
  const contentDescriptionId = useId()
  const chapterActionDescriptionId = useId()
  const chapterCount = chapters.length
  const hasChapters = chapterCount > 0
  const triggerLabel = hasChapters
    ? t`课程目录，${chapterCount} 个章节`
    : t`课程目录，暂无可跳转章节`
  const triggerDescription = hasChapters
    ? t`打开后可跳转到当前课堂中已出现的章节，不会改变课堂进度。`
    : t`章节会在课堂内容生成后出现。`
  const chapterActionDescription = t`跳转后目录会关闭，并把焦点移到对应章节；课堂进度不会改变。`

  const jumpToChapter = (chapter: typeof chapters[number]) => {
    scrollToBlockKey(chapter.blockKey)
    setJumpedChapterText(chapter.text)
    setOpen(false)
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={triggerLabel}
            aria-describedby={triggerDescriptionId}
            title={triggerDescription}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-tour-bg"
          >
            <BookOpen aria-hidden="true" className="size-4 shrink-0" />
          </button>
        </PopoverTrigger>
        <span id={triggerDescriptionId} className="sr-only">
          {triggerDescription}
        </span>
        <PopoverContent
          aria-labelledby={contentTitleId}
          aria-describedby={contentDescriptionId}
          className="w-72 max-w-[calc(100vw-1rem)] p-1"
          align="end"
          data-testid="classroom-live-chapter-index-content"
        >
          <div className="sr-only">
            <h2 id={contentTitleId}><Trans>课程目录</Trans></h2>
            <p id={contentDescriptionId}>
              {hasChapters
                ? t`选择章节后会滚动到课堂中的对应内容。`
                : t`当前课堂还没有可跳转章节。`}
            </p>
            <p id={chapterActionDescriptionId}>
              {chapterActionDescription}
            </p>
          </div>
          {!hasChapters
            ? (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  <div className="break-words font-medium text-tour-heading"><Trans>尚无章节</Trans></div>
                  <p className="mt-1 break-words leading-5"><Trans>章节会在课堂内容生成后出现。</Trans></p>
                </div>
              )
            : (
                <ul className="max-h-80 overflow-auto">
                  {chapters.map((chapter) => {
                    const chapterText = chapter.text
                    const chapterTitle = t`跳转到 ${chapterText}。${chapterActionDescription}`
                    return (
                      <li key={chapter.id}>
                        <button
                          type="button"
                          aria-describedby={chapterActionDescriptionId}
                          title={chapterTitle}
                          onClick={() => jumpToChapter(chapter)}
                          className={cn(
                            'w-full min-w-0 truncate rounded px-3 py-1.5 text-left text-sm hover:bg-tour-bg',
                            chapter.level === 3 && 'pl-6 text-xs',
                          )}
                        >
                          {chapter.text}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
        </PopoverContent>
      </Popover>
      <span data-testid="classroom-live-chapter-jump-status" role="status" className="sr-only">
        {jumpedChapterText ? t`已跳转到 ${jumpedChapterText}` : ''}
      </span>
    </>
  )
}
