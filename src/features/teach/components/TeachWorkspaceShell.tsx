'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, PointerEvent as ReactPointerEvent } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import type { WorkspaceView } from '@/features/teach/state/workspace-store'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import type { NavView } from './WorkspaceNav'
import { WorkspaceNav } from './WorkspaceNav'
import { ProgressDashboardView } from './views/ProgressDashboardView'
import { MissionView } from './views/MissionView'
import { GlossaryView } from './views/GlossaryView'
import { LessonsListView } from './views/LessonsListView'
import { RecordsView } from './views/RecordsView'
import { ReferenceView } from './views/ReferenceView'
import { NotesView } from './views/NotesView'
import { LessonView } from './views/LessonView'
import { MissionGate } from './views/MissionGate'
import { useWorkspaceResource } from './views/use-workspace-resource'

export interface TeachWorkspaceShellProps {
  /**
   * The teacher chat surface (Task 28's `TeacherChatRuntime`). Injected so the
   * shell layout stays decoupled from the chat runtime; tests pass a stub.
   */
  chat: ReactNode
}

/**
 * Render the central viewport for the active view. A single open lesson
 * (`'lesson'`) is keyed by its id so switching lessons remounts the renderer
 * with fresh per-lesson state instead of carrying over the prior lesson.
 *
 * Mission-first gating: while `missionReady` is false the lessons surface
 * (`'lessons'` / `'lesson'`) is replaced by the {@link MissionGate} guidance so
 * the learner cannot reach lessons before a mission is set with the teacher.
 */
function CentralViewport({
  view,
  missionReady,
  currentLessonId,
  currentReferenceId,
}: {
  view: WorkspaceView
  missionReady: boolean
  currentLessonId: string | null
  currentReferenceId: string | null
}) {
  switch (view) {
    case 'overview':
      return <ProgressDashboardView />
    case 'mission':
      return <MissionView />
    case 'lessons':
      return missionReady ? <LessonsListView /> : <MissionGate />
    case 'lesson':
      return missionReady
        ? <LessonView key={currentLessonId ?? 'none'} lessonId={currentLessonId} />
        : <MissionGate />
    case 'glossary':
      return <GlossaryView />
    case 'reference':
      return <ReferenceView referenceId={currentReferenceId} />
    case 'records':
      return <RecordsView />
    case 'notes':
      return <NotesView />
    default:
      return null
  }
}

/** Nav entries gated behind a set mission, frozen so the prop stays referentially stable. */
const MISSION_GATED_VIEWS: ReadonlySet<NavView> = new Set<NavView>(['lessons'])
const NO_GATED_VIEWS: ReadonlySet<NavView> = new Set<NavView>()
/** The lessons entry, highlighted the moment a mission unlocks it. */
const LESSONS_HIGHLIGHT: ReadonlySet<NavView> = new Set<NavView>(['lessons'])

// Resizable teacher-chat column (desktop only). Width is clamped so the central
// content keeps a usable minimum, and persisted so the preference sticks.
const CHAT_WIDTH_KEY = 'teach:chat-width'
const CHAT_MIN_WIDTH = 300
const CHAT_MAX_WIDTH = 720
const CHAT_DEFAULT_WIDTH = 384
const CHAT_KEYBOARD_STEP = 24

function clampChatWidth(px: number): number {
  const cap = typeof window === 'undefined'
    ? CHAT_MAX_WIDTH
    : Math.max(CHAT_MIN_WIDTH, Math.min(CHAT_MAX_WIDTH, window.innerWidth - 360))
  return Math.min(cap, Math.max(CHAT_MIN_WIDTH, Math.round(px)))
}

/**
 * The teaching-workspace shell: a three-region layout.
 *
 *  - **Left** — {@link WorkspaceNav}, the six document sections.
 *  - **Center** — the active document view or the open lesson (rendered by
 *    {@link LessonRenderer} through {@link LessonView}).
 *  - **Right** — the teacher chat (injected `chat`).
 *
 * On desktop the three regions sit side by side. On mobile the chat collapses
 * into a bottom drawer toggled by a floating button; `data-open` on the chat
 * region reflects the drawer state (always logically open on desktop, where the
 * column is shown by responsive class). The shell reads only `view` /
 * selection state from the workspace store; documents load from the repository
 * inside each view.
 */
export function TeachWorkspaceShell({ chat }: TeachWorkspaceShellProps) {
  const { repo } = useWorkspace()
  const view = useWorkspaceStore(s => s.view)
  const currentLessonId = useWorkspaceStore(s => s.currentLessonId)
  const currentReferenceId = useWorkspaceStore(s => s.currentReferenceId)
  const [chatOpen, setChatOpen] = useState(false)
  const isMobile = useIsMobile()
  const chatRegionId = useId()
  // On mobile the chat is an off-screen drawer when closed; mark it `inert` so its
  // composer/buttons drop out of the tab order and the a11y tree instead of being
  // focusable while invisible. On desktop the chat is a persistent column, so it
  // must never be inert (chatOpen stays false there).
  const chatInert = isMobile && !chatOpen

  // When a lesson block or a cold-start preset queues a chat prefill, surface it:
  // on mobile the chat is a closed bottom drawer, so open it so the seeded message
  // is visible instead of silently landing in a hidden composer.
  const pendingPrefill = useWorkspaceStore(s => s.pendingPrefill)
  useEffect(() => {
    if (pendingPrefill !== null && isMobile)
      // eslint-disable-next-line react/set-state-in-effect -- reacting to an external store event (a queued prefill) by opening the drawer; not derivable render state
      setChatOpen(true)
  }, [pendingPrefill, isMobile])

  // Resizable chat column. Load the persisted width after mount (SSR markup stays
  // at the default to avoid a hydration mismatch), then persist later changes.
  const chatRef = useRef<HTMLElement>(null)
  const [chatWidth, setChatWidth] = useState(CHAT_DEFAULT_WIDTH)
  const persistArmedRef = useRef(false)
  useEffect(() => {
    const saved = Number(localStorage.getItem(CHAT_WIDTH_KEY))
    if (Number.isFinite(saved) && saved > 0)
      // eslint-disable-next-line react/set-state-in-effect -- one-time post-mount load of the persisted width; kept out of the useState initializer so the SSR markup stays at the default and does not hydrate-mismatch
      setChatWidth(clampChatWidth(saved))
  }, [])
  useEffect(() => {
    if (!persistArmedRef.current) {
      persistArmedRef.current = true
      return
    }
    localStorage.setItem(CHAT_WIDTH_KEY, String(chatWidth))
  }, [chatWidth])

  const startChatResize = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const rightEdge = chatRef.current?.getBoundingClientRect().right ?? window.innerWidth
    const onMove = (ev: PointerEvent) => setChatWidth(clampChatWidth(rightEdge - ev.clientX))
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.removeProperty('user-select')
      document.body.style.removeProperty('cursor')
    }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [])

  const onChatHandleKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    // Chat sits on the right, so ArrowLeft widens it and ArrowRight narrows it.
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setChatWidth(w => clampChatWidth(w + CHAT_KEYBOARD_STEP))
    }
    else if (e.key === 'ArrowRight') {
      e.preventDefault()
      setChatWidth(w => clampChatWidth(w - CHAT_KEYBOARD_STEP))
    }
  }, [])

  // Mission-first gating: lessons are grounded in the learner's mission, so they
  // stay locked until a mission exists. Read it here once and drive both the nav
  // (disabled lessons entry) and the central viewport (gate vs. lessons surface).
  // While the read is in flight the workspace is treated as not-yet-ready so the
  // gate never flashes the lessons list before the mission resolves.
  const { data: mission, loading: missionLoading } = useWorkspaceResource(() => repo.getMission(), [repo], 'mission')
  const missionReady = !missionLoading && mission != null

  // Surface the moment lessons unlock: when the learner sets a mission *during the
  // session* (we had been showing the gate), the lessons nav entry flips from
  // disabled to enabled — nudge it so the change is not silent. Skipped for a
  // returning learner who already had a mission on load (no gate was shown), and
  // cleared once they open the lessons section.
  const [lessonsUnlocked, setLessonsUnlocked] = useState(false)
  const sawNoMissionRef = useRef(false)
  const prevMissionReadyRef = useRef(false)
  useEffect(() => {
    if (!missionLoading && mission == null)
      sawNoMissionRef.current = true
    if (missionReady && !prevMissionReadyRef.current && sawNoMissionRef.current) {
      sawNoMissionRef.current = false
      if (view !== 'lessons' && view !== 'lesson')
        // eslint-disable-next-line react/set-state-in-effect -- one-shot reaction to the mission-set transition (an external event), not derivable render state
        setLessonsUnlocked(true)
    }
    prevMissionReadyRef.current = missionReady
  }, [missionReady, missionLoading, mission, view])
  useEffect(() => {
    if (view === 'lessons' || view === 'lesson')
      // eslint-disable-next-line react/set-state-in-effect -- clear the nudge once the learner reaches the lessons section
      setLessonsUnlocked(false)
  }, [view])

  return (
    <div
      data-testid="teach-workspace-shell"
      className="relative flex h-full min-h-0 w-full bg-background text-foreground"
    >
      {/*
        A single nav instance. On desktop it is a left sidebar; on mobile it
        becomes a top strip (horizontal scroll), keeping one DOM node so nav
        items stay uniquely addressable.
      */}
      <aside
        className={cn(
          'shrink-0 border-border/60 bg-card/30',
          'absolute inset-x-0 top-0 z-10 overflow-x-auto border-b p-2 backdrop-blur',
          'md:static md:flex md:w-56 md:flex-col md:gap-2 md:overflow-visible md:border-e md:border-b-0 md:p-3 md:backdrop-blur-none',
        )}
      >
        <WorkspaceNav
          disabledViews={missionReady ? NO_GATED_VIEWS : MISSION_GATED_VIEWS}
          highlightedViews={lessonsUnlocked ? LESSONS_HIGHLIGHT : NO_GATED_VIEWS}
        />
      </aside>

      <main
        data-testid="workspace-viewport"
        className="flex min-w-0 flex-1 flex-col overflow-y-auto px-4 pb-5 pt-16 md:px-8 md:py-8"
      >
        <div className="mx-auto w-full max-w-3xl">
          <CentralViewport
            view={view}
            missionReady={missionReady}
            currentLessonId={currentLessonId}
            currentReferenceId={currentReferenceId}
          />
        </div>
      </main>

      <section
        ref={chatRef}
        id={chatRegionId}
        data-testid="workspace-chat"
        data-open={chatOpen ? 'true' : 'false'}
        inert={chatInert}
        style={isMobile ? undefined : { width: chatWidth }}
        className={cn(
          // Desktop: a persistent, resizable right-hand column (width via style).
          'md:relative md:flex md:shrink-0 md:flex-col md:border-s md:border-border/60 md:bg-card/20',
          // Mobile: a bottom drawer toggled by the floating button.
          'fixed inset-x-0 bottom-0 z-30 flex h-[70vh] flex-col border-t border-border/60 bg-background shadow-2xl transition-transform md:inset-auto md:h-auto md:translate-y-0 md:shadow-none',
          chatOpen ? 'translate-y-0' : 'translate-y-full md:translate-y-0',
        )}
      >
        {/* Desktop drag handle to resize the chat column (hidden on mobile). */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t`调整对话栏宽度`}
          aria-valuenow={Math.round(chatWidth)}
          aria-valuemin={CHAT_MIN_WIDTH}
          aria-valuemax={CHAT_MAX_WIDTH}
          tabIndex={0}
          onPointerDown={startChatResize}
          onKeyDown={onChatHandleKeyDown}
          className="group absolute inset-y-0 -start-1 z-20 hidden w-2 cursor-col-resize touch-none md:block"
        >
          <span className="absolute inset-y-0 start-1/2 w-px -translate-x-1/2 bg-border/70 transition-colors group-hover:bg-primary/60 group-focus-visible:w-0.5 group-focus-visible:bg-primary" />
        </div>
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-2 md:hidden">
          <span className="text-sm font-semibold">
            <Trans>老师</Trans>
          </span>
          <button
            type="button"
            data-testid="workspace-chat-close"
            onClick={() => setChatOpen(false)}
            aria-label={t`收起老师对话`}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1">{chat}</div>
      </section>

      <button
        type="button"
        data-testid="workspace-chat-toggle"
        onClick={() => setChatOpen(open => !open)}
        aria-label={chatOpen ? t`收起老师对话` : t`打开老师对话`}
        aria-expanded={chatOpen}
        aria-controls={chatRegionId}
        className="fixed bottom-4 end-4 z-20 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg md:hidden"
      >
        {chatOpen
          ? <X aria-hidden="true" className="size-5" />
          : <MessageCircle aria-hidden="true" className="size-5" />}
      </button>
    </div>
  )
}
