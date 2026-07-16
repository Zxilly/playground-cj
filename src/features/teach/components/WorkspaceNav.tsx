'use client'

import { BookOpen, FileText, LayoutDashboard, NotebookPen, ScrollText, SpellCheck, Target } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { t } from '@lingui/core/macro'
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
  { view: 'overview', icon: LayoutDashboard, label: <Trans>概览</Trans> },
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
  /**
   * Nav entries to draw attention to (e.g. the lessons entry the moment a mission
   * unlocks it). A highlighted-but-inactive entry gets a ring + a small dot so the
   * change is not silent; the shell clears it once the learner opens that section.
   */
  highlightedViews?: ReadonlySet<NavView>
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
export function WorkspaceNav({ disabledViews, highlightedViews }: WorkspaceNavProps = {}) {
  const view = useWorkspaceStore(s => s.view)
  const setView = useWorkspaceStore(s => s.setView)
  const active = activeNavView(view)

  return (
    <nav
      data-testid="workspace-nav"
      aria-label={t`课堂导航`}
      className="flex min-w-max flex-row gap-1.5 lg:min-w-0 lg:flex-col"
    >
      {NAV_ENTRIES.map(({ view: entryView, icon: Icon, label }) => {
        const isActive = entryView === active
        const isDisabled = disabledViews?.has(entryView) ?? false
        // Only nudge an entry that is reachable and not already the one in view.
        const isHighlighted = !isDisabled && !isActive && (highlightedViews?.has(entryView) ?? false)
        return (
          <button
            key={entryView}
            type="button"
            data-testid={`workspace-nav-${entryView}`}
            data-nav-item="true"
            data-highlighted={isHighlighted ? 'true' : undefined}
            aria-current={isActive ? 'page' : undefined}
            aria-disabled={isDisabled ? 'true' : undefined}
            disabled={isDisabled}
            onClick={() => {
              if (!isDisabled)
                setView(entryView)
            }}
            className={cn(
              'relative flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-start text-xs font-medium outline-none transition-[background-color,color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/35 lg:w-full lg:gap-3 lg:text-sm',
              isDisabled
                ? 'cursor-not-allowed text-muted-foreground/40'
                : isActive
                  ? 'bg-primary/11 text-primary shadow-[inset_0_0_0_1px_rgba(18,112,91,0.08)]'
                  : 'text-muted-foreground hover:bg-accent/70 hover:text-accent-foreground',
              isHighlighted && 'text-primary ring-1 ring-primary/45 ring-inset animate-in fade-in duration-300 motion-reduce:animate-none',
            )}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <span className="min-w-0 max-w-20 flex-1 truncate lg:max-w-none">{label}</span>
            {isHighlighted && (
              <span aria-hidden="true" className="absolute end-1.5 top-1.5 size-1.5 rounded-full bg-primary lg:static lg:ms-auto" />
            )}
          </button>
        )
      })}
    </nav>
  )
}
