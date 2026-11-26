'use client'

import { BookOpenCheck, Code2, ListTree, Radio } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@/lib/utils'
import type { WorkspaceView } from '@/features/teach/state/workspace-store'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import { useWorkspaceHistoryNavigation } from '@/features/teach/navigation/workspace-history-context'

interface NavEntry {
  view: WorkspaceView
  icon: LucideIcon
  label: MessageDescriptor
  shortLabel: MessageDescriptor
}

const NAV_ENTRIES: NavEntry[] = [
  { view: 'live', icon: Radio, label: msg`实时课堂`, shortLabel: msg`课堂` },
  { view: 'review', icon: BookOpenCheck, label: msg`概念复习`, shortLabel: msg`复习` },
  { view: 'progress', icon: ListTree, label: msg({ message: '学习进度', context: 'nav' }), shortLabel: msg`进度` },
  { view: 'playground', icon: Code2, label: msg`练习场`, shortLabel: msg({ message: '练习', context: 'nav-short' }) },
]

/** Navigation mirrors the four canonical AI Classroom surfaces. */
export function WorkspaceNav() {
  const { i18n, t } = useLingui()
  const view = useWorkspaceStore(state => state.view)
  const teacherChatRunMode = useWorkspaceStore(state => state.teacherChatRunMode)
  const navigate = useWorkspaceHistoryNavigation()
  const navigationStatusId = 'teacher-chat-navigation-status'

  return (
    <div className="w-full min-w-0">
      <nav
        data-testid="workspace-nav"
        aria-label={t`课堂导航`}
        className="grid w-full min-w-0 grid-cols-4 gap-1 lg:flex lg:flex-col lg:gap-1.5"
      >
        {NAV_ENTRIES.map(({ view: entryView, icon: Icon, label, shortLabel }) => {
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
              <span className="truncate lg:hidden">{i18n._(shortLabel)}</span>
              <span className="hidden truncate lg:inline">{i18n._(label)}</span>
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
          <Trans>AI 老师正在回复。你仍可自由切换页面查看内容；在实时课堂与复习页之间切换会切换对话上下文。</Trans>
        </p>
      )}
    </div>
  )
}
