'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { MessageCircle, Sparkles, X } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import type { WorkspaceRepository } from '@/lib/teach/workspace/repository'
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

/**
 * Warm the lightweight document tabs while the learner is on the initial view.
 * Reads share the same repository-scoped cache as the visible views, so the
 * first tab click paints real content instead of a transient loading skeleton.
 */
function WorkspaceResourcePreloader({ repo }: { repo: WorkspaceRepository }) {
  useWorkspaceResource(repo, 'lessons:list', () => repo.listLessons(), [repo], 'lessons')
  useWorkspaceResource(repo, 'glossary', () => repo.getGlossary(), [repo], 'glossary')
  useWorkspaceResource(repo, 'learningRecords', () => repo.listLearningRecords(), [repo], 'learningRecords')
  useWorkspaceResource(repo, 'references', () => repo.listReferences(), [repo], 'references')
  useWorkspaceResource(repo, 'notes', () => repo.getNotes(), [repo], 'notes')
  useWorkspaceResource(
    repo,
    'retrieval',
    () => typeof repo.listRetrieval === 'function' ? repo.listRetrieval() : Promise.resolve([]),
    [repo],
    'retrieval',
  )
  return null
}

/** Responsive document workspace with a persistent desktop teacher panel. */
export function TeachWorkspaceShell({ chat }: TeachWorkspaceShellProps) {
  const { repo } = useWorkspace()
  const view = useWorkspaceStore(state => state.view)
  const setView = useWorkspaceStore(state => state.setView)
  const currentLessonId = useWorkspaceStore(state => state.currentLessonId)
  const currentReferenceId = useWorkspaceStore(state => state.currentReferenceId)
  const pendingPrefill = useWorkspaceStore(state => state.pendingPrefill)
  const [chatOpen, setChatOpen] = useState(false)
  const isCompact = useIsCompactViewport()
  const reduceMotion = useReducedMotion()
  const chatRegionId = useId()
  const chatTitleId = useId()
  const chatToggleRef = useRef<HTMLButtonElement>(null)
  const { chatMaxWidth, chatRef, chatWidth, onHandleKeyDown, startResize } = useResizableChatPanel()
  const chatInert = isCompact && !chatOpen
  const previousCompactRef = useRef(isCompact)

  useLayoutEffect(() => {
    if (isCompact && !previousCompactRef.current) {
      // The central workspace is the primary learning surface. A desktop chat
      // column becoming a mobile drawer must not cover it merely because the
      // viewport crossed a breakpoint; only an explicit learner action or a
      // teacher prefill should open the compact drawer.
      // eslint-disable-next-line react/set-state-in-effect -- one-shot response to a viewport breakpoint transition
      setChatOpen(false)
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
    repo,
    'mission',
    () => repo.getMission(),
    [repo],
    'mission',
  )
  const missionReady = !missionLoading && mission != null
  const viewTransitionKey = view === 'lesson'
    ? `lesson:${currentLessonId ?? 'none'}`
    : view === 'reference'
      ? `reference:${currentReferenceId ?? 'list'}`
      : view

  useEffect(() => {
    if (missionLoading || mission != null)
      return
    const currentView = useWorkspaceStore.getState().view
    if (currentView === 'lessons' || currentView === 'lesson')
      setView('mission')
  }, [mission, missionLoading, setView])

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
      <WorkspaceResourcePreloader repo={repo} />

      <aside
        inert={isCompact && chatOpen}
        className={cn(
          'teach-scrollbar-hidden shrink-0 border-border bg-sidebar',
          'absolute inset-x-0 top-0 z-10 overflow-x-auto border-b px-2 py-2',
          'lg:static lg:flex lg:w-52 lg:flex-col lg:gap-2 lg:overflow-visible lg:border-e lg:border-b-0 lg:px-3 lg:py-4',
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
        className="relative min-w-0 flex-1 overflow-hidden bg-background"
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={viewTransitionKey}
            data-testid="workspace-view-transition"
            data-view={view}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.14, ease: 'easeOut' }}
            className={cn(
              'absolute inset-0 h-full min-h-0 w-full bg-background',
              view === 'playground'
                ? 'overflow-hidden px-0 pb-0 pt-16 lg:p-0'
                : 'overflow-y-auto px-4 pb-7 pt-20 sm:px-6 lg:px-8 lg:py-8',
            )}
          >
            <div className={cn(
              view === 'playground'
                ? 'h-full min-h-0 w-full'
                : 'mx-auto w-full max-w-4xl',
            )}
            >
              <WorkspaceViewport
                view={view}
                missionReady={missionReady}
                currentLessonId={currentLessonId}
                currentReferenceId={currentReferenceId}
              />
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      {isCompact && chatOpen && (
        <button
          type="button"
          aria-label={t`收起老师对话`}
          onClick={closeChat}
          className="fixed inset-0 z-40 cursor-default bg-foreground/30 lg:hidden"
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
          'lg:relative lg:flex lg:shrink-0 lg:flex-col lg:border-s lg:border-border lg:bg-background',
          'fixed inset-x-0 bottom-0 z-40 flex h-[min(78dvh,46rem)] flex-col overflow-hidden rounded-t-lg border-t border-border bg-background shadow-lg transition-transform duration-300 ease-out lg:inset-auto lg:h-auto lg:translate-y-0 lg:rounded-none lg:shadow-none',
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

        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center text-primary">
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
            className="rounded-md text-muted-foreground lg:hidden"
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
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] end-4 z-20 size-12 rounded-md shadow-md lg:hidden"
      >
        {chatOpen
          ? <X aria-hidden="true" className="size-5" />
          : <MessageCircle aria-hidden="true" className="size-5" />}
      </Button>
    </div>
  )
}
