'use client'

import { BookOpen, FileText, NotebookPen, ScrollText, SpellCheck, Target } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { WorkspaceView } from '@/features/teach/state/workspace-store'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'

/**
 * The top-level navigation entry a click maps to. `'lesson'` is intentionally
 * absent — it is reached by opening a lesson from the lessons list, not from the
 * nav — so opening a lesson keeps the `'lessons'` entry highlighted.
 */
export type NavView = Exclude<WorkspaceView, 'lesson'>

interface NavEntry {
  view: NavView
  icon: LucideIcon
  label: ReactNode
}

const NAV_ENTRIES: NavEntry[] = [
  { view: 'mission', icon: Target, label: <Trans>学习目标</Trans> },
  { view: 'lessons', icon: BookOpen, label: <Trans>课程</Trans> },
  { view: 'glossary', icon: SpellCheck, label: <Trans>术语表</Trans> },
  { view: 'reference', icon: FileText, label: <Trans>速查</Trans> },
  { view: 'records', icon: ScrollText, label: <Trans>学习记录</Trans> },
  { view: 'notes', icon: NotebookPen, label: <Trans>偏好笔记</Trans> },
]

/**
 * Map the active workspace view to the nav entry that owns it. Opening a single
 * lesson (`view === 'lesson'`) keeps the `lessons` entry active so the learner
 * sees they are still inside the lessons section.
 */
function activeNavView(view: WorkspaceView): NavView {
  return view === 'lesson' ? 'lessons' : view
}

export interface WorkspaceNavProps {
  /**
   * Nav entries to render disabled (mission-first gating). A disabled entry is
   * non-clickable (`disabled` + `aria-disabled`) and never switches `view`, so
   * the lessons surface stays out of reach until a mission exists.
   */
  disabledViews?: ReadonlySet<NavView>
}

/**
 * Left-hand workspace navigation: the six document sections (Mission / Lessons /
 * Glossary / Reference / Records / Notes). Clicking an entry switches the central
 * viewport via the workspace store. The current section is marked with
 * `aria-current="page"`. Holds no domain data — it only drives `view` state.
 *
 * Mission-first gating: entries in `disabledViews` (the lessons entry while no
 * mission exists) render disabled and ignore clicks, keeping the lessons surface
 * unreachable until the learner has set a mission with the teacher.
 */
export function WorkspaceNav({ disabledViews }: WorkspaceNavProps = {}) {
  const view = useWorkspaceStore(s => s.view)
  const setView = useWorkspaceStore(s => s.setView)
  const active = activeNavView(view)

  return (
    <nav data-testid="workspace-nav" aria-label="Workspace" className="flex flex-row gap-1 md:flex-col">
      {NAV_ENTRIES.map(({ view: entryView, icon: Icon, label }) => {
        const isActive = entryView === active
        const isDisabled = disabledViews?.has(entryView) ?? false
        return (
          <button
            key={entryView}
            type="button"
            data-testid={`workspace-nav-${entryView}`}
            data-nav-item="true"
            aria-current={isActive ? 'page' : undefined}
            aria-disabled={isDisabled ? 'true' : undefined}
            disabled={isDisabled}
            onClick={() => {
              if (!isDisabled)
                setView(entryView)
            }}
            className={cn(
              'flex shrink-0 items-center gap-3 rounded-md px-3 py-2 text-start text-sm font-medium transition-colors md:w-full',
              isDisabled
                ? 'cursor-not-allowed text-muted-foreground/40'
                : isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
