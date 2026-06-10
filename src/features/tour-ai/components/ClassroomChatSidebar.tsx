'use client'

import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { TourAIChat } from '@/features/tour-ai/components/TourAIChat'

export function ClassroomChatSidebar({
  activeConceptId,
  onClose,
  onUseCurrentExerciseContext,
}: {
  activeConceptId?: string
  onClose: () => void
  onUseCurrentExerciseContext?: (conceptId: string) => void
}) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  const description = activeConceptId
    ? t`聊天会优先围绕当前概念作为上下文；关闭浮层不会改变课堂进度。`
    : t`聊天会使用当前课堂内容作为上下文；关闭浮层不会改变课堂进度。`
  const closeActionTitle = t`关闭聊天浮层；不会改变课堂进度、当前代码或已保存的课堂记录。`

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const root = document.documentElement
    const body = document.body
    const previousRootOverflow = root.style.overflow
    const previousBodyOverflow = body.style.overflow
    const previousRootOverscrollBehavior = root.style.overscrollBehavior
    const previousBodyOverscrollBehavior = body.style.overscrollBehavior

    root.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    root.style.overscrollBehavior = 'contain'
    body.style.overscrollBehavior = 'contain'

    return () => {
      root.style.overflow = previousRootOverflow
      body.style.overflow = previousBodyOverflow
      root.style.overscrollBehavior = previousRootOverscrollBehavior
      body.style.overscrollBehavior = previousBodyOverscrollBehavior
    }
  }, [])

  useEffect(() => {
    closeButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab')
        return

      const dialog = dialogRef.current
      if (!dialog)
        return

      const focusableElements = Array.from(dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter(element => element.tabIndex >= 0)
      if (focusableElements.length === 0) {
        event.preventDefault()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      const activeElement = document.activeElement

      if (!dialog.contains(activeElement)) {
        event.preventDefault()
        firstElement?.focus()
        return
      }
      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault()
        lastElement?.focus()
        return
      }
      if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault()
        firstElement?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      <div
        aria-hidden="true"
        data-testid="classroom-chat-overlay"
        className="absolute inset-0 bg-black/20 pointer-events-auto"
        onClick={onClose}
      />
      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        data-testid="classroom-chat-sidebar"
        className="fixed inset-y-0 right-0 z-10 flex h-full w-full max-w-[390px] shrink-0 flex-col border-l border-tour-border bg-tour-surface shadow-[-12px_0_32px_rgba(31,27,22,.12)] pointer-events-auto dark:shadow-[-12px_0_32px_rgba(0,0,0,.4)]"
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-tour-border px-4">
          <div id={titleId} className="text-sm font-semibold text-tour-text">
            <Trans>聊天</Trans>
          </div>
          <div id={descriptionId} className="sr-only">
            {description}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label={t`关闭聊天`}
            aria-describedby={descriptionId}
            title={closeActionTitle}
            onClick={onClose}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-tour-bg"
          >
            <X aria-hidden="true" className="size-4 shrink-0" />
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <TourAIChat activeConceptId={activeConceptId} onUseCurrentExerciseContext={onUseCurrentExerciseContext} />
        </div>
      </aside>
    </div>
  )
}
