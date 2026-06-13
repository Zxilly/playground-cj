'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import { cn } from '@/lib/utils'
import type { WorkspaceView } from '@/features/teach/state/workspace-store'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import { WorkspaceNav } from './WorkspaceNav'
import { MissionView } from './views/MissionView'
import { GlossaryView } from './views/GlossaryView'
import { LessonsListView } from './views/LessonsListView'
import { RecordsView } from './views/RecordsView'
import { ReferenceView } from './views/ReferenceView'
import { NotesView } from './views/NotesView'
import { LessonView } from './views/LessonView'

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
 */
function CentralViewport({
  view,
  currentLessonId,
  currentReferenceId,
}: {
  view: WorkspaceView
  currentLessonId: string | null
  currentReferenceId: string | null
}) {
  switch (view) {
    case 'mission':
      return <MissionView />
    case 'lessons':
      return <LessonsListView />
    case 'lesson':
      return <LessonView key={currentLessonId ?? 'none'} lessonId={currentLessonId} />
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
  const view = useWorkspaceStore(s => s.view)
  const currentLessonId = useWorkspaceStore(s => s.currentLessonId)
  const currentReferenceId = useWorkspaceStore(s => s.currentReferenceId)
  const [chatOpen, setChatOpen] = useState(false)

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
        <WorkspaceNav />
      </aside>

      <main
        data-testid="workspace-viewport"
        className="flex min-w-0 flex-1 flex-col overflow-y-auto px-4 pb-5 pt-16 md:px-8 md:py-8"
      >
        <div className="mx-auto w-full max-w-3xl">
          <CentralViewport
            view={view}
            currentLessonId={currentLessonId}
            currentReferenceId={currentReferenceId}
          />
        </div>
      </main>

      <section
        data-testid="workspace-chat"
        data-open={chatOpen ? 'true' : 'false'}
        className={cn(
          // Desktop: a persistent right-hand column.
          'md:relative md:flex md:w-96 md:shrink-0 md:flex-col md:border-s md:border-border/60 md:bg-card/20',
          // Mobile: a bottom drawer toggled by the floating button.
          'fixed inset-x-0 bottom-0 z-30 flex h-[70vh] flex-col border-t border-border/60 bg-background shadow-2xl transition-transform md:inset-auto md:h-auto md:translate-y-0 md:shadow-none',
          chatOpen ? 'translate-y-0' : 'translate-y-full md:translate-y-0',
        )}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-2 md:hidden">
          <span className="text-sm font-semibold">
            <Trans>老师</Trans>
          </span>
          <button
            type="button"
            data-testid="workspace-chat-close"
            onClick={() => setChatOpen(false)}
            aria-label="Close chat"
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
        aria-label="Open chat"
        className="fixed bottom-4 end-4 z-20 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg md:hidden"
      >
        <MessageCircle aria-hidden="true" className="size-5" />
      </button>
    </div>
  )
}
