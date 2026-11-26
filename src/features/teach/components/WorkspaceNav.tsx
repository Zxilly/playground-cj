'use client'

import { BookOpenCheck, Code2, ListTree, Radio } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkspaceView } from '@/features/teach/state/workspace-store'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
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
          return (
            <button
              key={entryView}
              type="button"
              data-testid={`workspace-nav-${entryView}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => navigate(entryView)}
              className={cn(
                'flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-md px-1 py-2 text-center text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/35 sm:gap-2 sm:px-2 sm:text-xs lg:w-full lg:justify-start lg:gap-3 lg:px-3 lg:text-start lg:text-sm',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-background hover:text-foreground',
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
            ? 'AI teacher is responding. You can still browse other views freely; switching between Live and Review changes the chat context.'
            : 'AI 老师正在回复。你仍可自由切换页面查看内容；在实时课堂与复习页之间切换会切换对话上下文。'}
        </p>
      )}
    </div>
  )
}
