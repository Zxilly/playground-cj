'use client'

import { BookOpenCheck, Code2, ListTree, Radio } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkspaceView } from '@/features/teach/state/workspace-store'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import { useWorkspace } from '@/features/teach/context/useWorkspace'

interface NavEntry {
  view: WorkspaceView
  icon: LucideIcon
  zh: string
  en: string
}

const NAV_ENTRIES: NavEntry[] = [
  { view: 'live', icon: Radio, zh: '实时课堂', en: 'Live View' },
  { view: 'review', icon: BookOpenCheck, zh: '概念复习', en: 'Review View' },
  { view: 'progress', icon: ListTree, zh: '学习进度', en: 'Progress' },
  { view: 'playground', icon: Code2, zh: '练习场', en: 'Playground' },
]

/** Navigation mirrors the four canonical AI Classroom surfaces. */
export function WorkspaceNav() {
  const { lang } = useWorkspace()
  const view = useWorkspaceStore(state => state.view)
  const setView = useWorkspaceStore(state => state.setView)

  return (
    <nav
      data-testid="workspace-nav"
      aria-label={lang === 'en' ? 'Classroom navigation' : '课堂导航'}
      className="flex min-w-max flex-row gap-1.5 lg:min-w-0 lg:flex-col"
    >
      {NAV_ENTRIES.map(({ view: entryView, icon: Icon, zh, en }) => {
        const active = view === entryView
        return (
          <button
            key={entryView}
            type="button"
            data-testid={`workspace-nav-${entryView}`}
            aria-current={active ? 'page' : undefined}
            onClick={() => setView(entryView)}
            className={cn(
              'flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 py-2 text-start text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/35 lg:w-full lg:gap-3 lg:text-sm',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-background hover:text-foreground',
            )}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <span>{lang === 'en' ? en : zh}</span>
          </button>
        )
      })}
    </nav>
  )
}
