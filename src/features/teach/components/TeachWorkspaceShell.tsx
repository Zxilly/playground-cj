'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { MessageCircle, Sparkles, X } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { Button } from '@/components/ui/button'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import {
  CHAT_MIN_WIDTH,
  useResizableChatPanel,
} from '@/features/teach/hooks/use-resizable-chat-panel'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import { useIsCompactViewport } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import type { NavView } from './WorkspaceNav'
import { WorkspaceNav } from './WorkspaceNav'
import { WorkspaceViewport } from './WorkspaceViewport'
import { useWorkspaceResource } from './views/use-workspace-resource'

export interface TeachWorkspaceShellProps {
  chat: ReactNode
}

const MISSION_GATED_VIEWS: ReadonlySet<NavView> = new Set<NavView>(['lessons'])
const NO_GATED_VIEWS: ReadonlySet<NavView> = new Set<NavView>()
const LESSONS_HIGHLIGHT: ReadonlySet<NavView> = new Set<NavView>(['lessons'])

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/** Responsive document workspace with a persistent desktop teacher panel. */
export function TeachWorkspaceShell({ chat }: TeachWorkspaceShellProps) {
  const { repo } = useWorkspace()
  const view = useWorkspaceStore(state => state.view)
  const currentLessonId = useWorkspaceStore(state => state.currentLessonId)
  const currentReferenceId = useWorkspaceStore(state => state.currentReferenceId)
  const pendingPrefill = useWorkspaceStore(state => state.pendingPrefill)
  const [chatOpen, setChatOpen] = useState(false)
  const isCompact = useIsCompactViewport()
  const chatRegionId = useId()
  const chatTitleId = useId()
  const chatToggleRef = useRef<HTMLButtonElement>(null)
  const { chatMaxWidth, chatRef, chatWidth, onHandleKeyDown, startResize } = useResizableChatPanel()
  const chatInert = isCompact && !chatOpen
  const previousCompactRef = useRef(isCompact)

  useLayoutEffect(() => {
    if (isCompact && !previousCompactRef.current) {
      // eslint-disable-next-line react/set-state-in-effect -- preserve the visible desktop chat when crossing into the drawer breakpoint
      setChatOpen(true)
    }
    previousCompactRef.current = isCompact
  }, [isCompact])

  useEffect(() => {
    if (pendingPrefill !== null && isCompact) {
      // eslint-disable-next-line react/set-state-in-effect -- external prefill events reveal the compact chat drawer
      setChatOpen(true)
    }
  }, [pendingPrefill, isCompact])

  useEffect(() => {
    if (!chatOpen || !isCompact)
      return
    const frame = requestAnimationFrame(() => {
      const preferred = chatRef.current?.querySelector<HTMLElement>('textarea:not([disabled])')
      const fallback = chatRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      ;(preferred ?? fallback)?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [chatOpen, isCompact, chatRef])

  const closeChat = useCallback(() => {
    setChatOpen(false)
    requestAnimationFrame(() => chatToggleRef.current?.focus())
  }, [])

  const onChatKeyDown = useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
    if (!isCompact)
      return
    if (event.key === 'Escape') {
      event.preventDefault()
      closeChat()
      return
    }
    if (event.key !== 'Tab')
      return

    const focusable = Array.from(chatRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [])
      .filter(element => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true')
    if (focusable.length === 0) {
      event.preventDefault()
      return
    }
    const first = focusable[0]
    const last = focusable.at(-1)
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    }
    else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }, [chatRef, closeChat, isCompact])

  const { data: mission, loading: missionLoading } = useWorkspaceResource(
    () => repo.getMission(),
    [repo],
    'mission',
  )
  const missionReady = !missionLoading && mission != null

  const [lessonsUnlocked, setLessonsUnlocked] = useState(false)
  const sawNoMissionRef = useRef(false)
  const prevMissionReadyRef = useRef(false)
  useEffect(() => {
    if (!missionLoading && mission == null)
      sawNoMissionRef.current = true
    if (missionReady && !prevMissionReadyRef.current && sawNoMissionRef.current) {
      sawNoMissionRef.current = false
      if (view !== 'lessons' && view !== 'lesson') {
        // eslint-disable-next-line react/set-state-in-effect -- one-shot response to an external repository transition
        setLessonsUnlocked(true)
      }
    }
    prevMissionReadyRef.current = missionReady
  }, [missionReady, missionLoading, mission, view])

  useEffect(() => {
    if (view === 'lessons' || view === 'lesson') {
      // eslint-disable-next-line react/set-state-in-effect -- clear the one-shot navigation nudge after it is visited
      setLessonsUnlocked(false)
    }
  }, [view])

  return (
    <div
      data-testid="teach-workspace-shell"
      className="relative flex h-full min-h-0 w-full overflow-hidden bg-background text-foreground"
    >
      <aside
        inert={isCompact && chatOpen}
        className={cn(
          'teach-scrollbar-hidden shrink-0 border-border/70 bg-sidebar/92',
          'absolute inset-x-0 top-0 z-10 overflow-x-auto border-b px-2 py-2 shadow-[0_1px_0_rgba(14,35,29,0.03)] backdrop-blur-xl',
          'lg:static lg:flex lg:w-52 lg:flex-col lg:gap-2 lg:overflow-visible lg:border-e lg:border-b-0 lg:px-3 lg:py-4 lg:shadow-none lg:backdrop-blur-none',
        )}
      >
        <WorkspaceNav
          disabledViews={missionReady ? NO_GATED_VIEWS : MISSION_GATED_VIEWS}
          highlightedViews={lessonsUnlocked ? LESSONS_HIGHLIGHT : NO_GATED_VIEWS}
        />
      </aside>

      <main
        data-testid="workspace-viewport"
        inert={isCompact && chatOpen}
        className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-muted/18 px-4 pb-7 pt-20 sm:px-7 lg:px-10 lg:py-10"
      >
        <div className="mx-auto w-full max-w-4xl">
          <WorkspaceViewport
            view={view}
            missionReady={missionReady}
            currentLessonId={currentLessonId}
            currentReferenceId={currentReferenceId}
          />
        </div>
      </main>

      {isCompact && chatOpen && (
        <button
          type="button"
          aria-label={t`收起老师对话`}
          onClick={closeChat}
          className="fixed inset-0 z-40 cursor-default bg-foreground/20 backdrop-blur-[1px] lg:hidden"
        />
      )}

      <section
        ref={chatRef}
        id={chatRegionId}
        data-testid="workspace-chat"
        data-open={chatOpen ? 'true' : 'false'}
        role={isCompact ? 'dialog' : undefined}
        aria-modal={isCompact ? true : undefined}
        aria-labelledby={chatTitleId}
        inert={chatInert}
        style={isCompact ? undefined : { width: chatWidth }}
        onKeyDown={onChatKeyDown}
        className={cn(
          'lg:relative lg:flex lg:shrink-0 lg:flex-col lg:border-s lg:border-border/70 lg:bg-card/65',
          'fixed inset-x-0 bottom-0 z-40 flex h-[min(78dvh,46rem)] flex-col overflow-hidden rounded-t-3xl border-t border-border/80 bg-background shadow-[0_-24px_80px_-30px_rgba(7,38,30,0.42)] transition-transform duration-300 ease-out lg:inset-auto lg:h-auto lg:translate-y-0 lg:rounded-none lg:shadow-none',
          chatOpen ? 'translate-y-0' : 'translate-y-full lg:translate-y-0',
        )}
      >
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t`调整对话栏宽度`}
          aria-valuenow={Math.round(chatWidth)}
          aria-valuemin={CHAT_MIN_WIDTH}
          aria-valuemax={Math.round(chatMaxWidth)}
          tabIndex={0}
          onPointerDown={startResize}
          onKeyDown={onHandleKeyDown}
          className="group absolute inset-y-0 -start-1 z-20 hidden w-2 cursor-col-resize touch-none lg:block"
        >
          <span className="absolute inset-y-0 start-1/2 w-px -translate-x-1/2 bg-border/80 transition-colors group-hover:bg-primary/60 group-focus-visible:w-0.5 group-focus-visible:bg-primary" />
        </div>

        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/70 bg-card/75 px-4 backdrop-blur-lg">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Sparkles aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0">
              <h2 id={chatTitleId} className="truncate text-sm font-semibold text-foreground">
                <Trans>老师</Trans>
              </h2>
              <p className="truncate text-[11px] text-muted-foreground"><Trans>与老师沟通</Trans></p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            data-testid="workspace-chat-close"
            onClick={closeChat}
            aria-label={t`收起老师对话`}
            className="rounded-lg text-muted-foreground lg:hidden"
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 pb-[env(safe-area-inset-bottom)]">{chat}</div>
      </section>

      <Button
        ref={chatToggleRef}
        type="button"
        size="icon-lg"
        data-testid="workspace-chat-toggle"
        onClick={() => (chatOpen ? closeChat() : setChatOpen(true))}
        aria-label={chatOpen ? t`收起老师对话` : t`打开老师对话`}
        aria-expanded={chatOpen}
        aria-controls={chatRegionId}
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] end-4 z-20 size-13 rounded-2xl shadow-[0_14px_35px_-12px_rgba(12,92,74,0.7)] lg:hidden"
      >
        {chatOpen
          ? <X aria-hidden="true" className="size-5" />
          : <MessageCircle aria-hidden="true" className="size-5" />}
      </Button>
    </div>
  )
}
