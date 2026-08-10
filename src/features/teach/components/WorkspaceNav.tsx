'use client'

import { BookOpenCheck, Code2, ListTree, Radio } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkspaceView } from '@/features/teach/state/workspace-store'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import { isWorkspaceViewBlocked } from '@/features/teach/navigation/workspace-view-url'
import { useWorkspaceHistoryNavigation } from '@/features/teach/navigation/workspace-history-context'

interface NavEntry {
  view: WorkspaceView
  icon: LucideIcon
  zh: string
  zhShort: string
  en: string
  enShort: string
}

const NAV_ENTRIES: NavEntry[] = [
  { view: 'live', icon: Radio, zh: '实时课堂', zhShort: '课堂', en: 'Live class', enShort: 'Live' },
  { view: 'review', icon: BookOpenCheck, zh: '概念复习', zhShort: '复习', en: 'Concept review', enShort: 'Review' },
  { view: 'progress', icon: ListTree, zh: '学习进度', zhShort: '进度', en: 'Progress', enShort: 'Progress' },
  { view: 'playground', icon: Code2, zh: '练习场', zhShort: '练习', en: 'Playground', enShort: 'Code' },
]

/** Navigation mirrors the four canonical AI Classroom surfaces. */
export function WorkspaceNav() {
  const { lang } = useWorkspace()
  const view = useWorkspaceStore(state => state.view)
  const teacherChatRunMode = useWorkspaceStore(state => state.teacherChatRunMode)
  const navigate = useWorkspaceHistoryNavigation()
  const navigationStatusId = 'teacher-chat-navigation-status'

  return (
    <div className="w-full min-w-0">
      <nav
        data-testid="workspace-nav"
        aria-label={lang === 'en' ? 'Classroom navigation' : '课堂导航'}
        className="grid w-full min-w-0 grid-cols-4 gap-1 lg:flex lg:flex-col lg:gap-1.5"
      >
        {NAV_ENTRIES.map(({ view: entryView, icon: Icon, zh, zhShort, en, enShort }) => {
          const active = view === entryView
          const blocked = isWorkspaceViewBlocked(entryView, teacherChatRunMode)
          return (
            <button
              key={entryView}
              type="button"
              data-testid={`workspace-nav-${entryView}`}
              aria-current={active ? 'page' : undefined}
              aria-disabled={blocked || undefined}
              aria-describedby={blocked ? navigationStatusId : undefined}
              onClick={() => {
                if (!blocked)
                  navigate(entryView)
              }}
              className={cn(
                'flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-md px-1 py-2 text-center text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/35 sm:gap-2 sm:px-2 sm:text-xs lg:w-full lg:justify-start lg:gap-3 lg:px-3 lg:text-start lg:text-sm',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-background hover:text-foreground',
                blocked && 'cursor-not-allowed opacity-45 hover:bg-transparent hover:text-muted-foreground',
              )}
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              <span className="truncate lg:hidden">{lang === 'en' ? enShort : zhShort}</span>
              <span className="hidden truncate lg:inline">{lang === 'en' ? en : zh}</span>
            </button>
          )
        })}
      </nav>
      {teacherChatRunMode !== null && (
        <p
          id={navigationStatusId}
          role="status"
          className="mt-1.5 rounded-md border border-border bg-muted/45 px-2 py-1.5 text-[11px] leading-4 text-muted-foreground"
        >
          {lang === 'en'
            ? 'A teacher response is in progress. Wait or stop it before switching chat context.'
            : '老师正在回复。请等待完成或停止生成后，再切换对话范围。'}
        </p>
      )}
    </div>
  )
}
