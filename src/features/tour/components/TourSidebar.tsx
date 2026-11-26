'use client'

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CheckCircle2, ChevronRight } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import type { TourChapterSlim } from '@/tour/types'
import { buildTourSectionKey, useTourProgressStore } from '@/stores/tourProgress'

interface TourSidebarProps {
  lang: string
  tourData: TourChapterSlim[]
  currentChapter: string
  currentSubChapter: string
  currentSection: string
  onNavigate: (chapterId: string, subChapterId: string, sectionId: string) => void
  sectionHref?: (chapterId: string, subChapterId: string, sectionId: string) => string
}

function ActiveCollapsible({ active, children, className }: { active: boolean, children: ReactNode, className: string }) {
  const [state, setState] = useState({ active, open: active })
  if (state.active !== active)
    setState({ active, open: active || state.open })

  return <Collapsible open={state.open} onOpenChange={open => setState({ active, open })} className={className}>{children}</Collapsible>
}

export function TourSidebar({
  lang,
  tourData,
  currentChapter,
  currentSubChapter,
  currentSection,
  onNavigate,
  sectionHref,
}: TourSidebarProps) {
  const { isMobile, setOpenMobile } = useSidebar()
  const hydrated = useTourProgressStore(state => state.hydrated)
  const visitedSections = useTourProgressStore(state => state.visitedSections)

  const { totalCount, visitedCount } = useMemo(() => {
    let total = 0
    let visited = 0
    for (const chapter of tourData) {
      for (const sub of chapter.subChapters) {
        for (const section of sub.sections) {
          total += 1
          if (hydrated && visitedSections[buildTourSectionKey(chapter.id, sub.id, section.id)])
            visited += 1
        }
      }
    }
    return { totalCount: total, visitedCount: visited }
  }, [hydrated, tourData, visitedSections])

  const progressPercent = totalCount > 0 ? Math.round((visitedCount / totalCount) * 100) : 0

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarContent>
        <ScrollArea className="h-full">
          <SidebarGroup>
            <SidebarGroupLabel className="font-semibold text-tour-accent-fg">
              <Trans>仓颉之旅</Trans>
            </SidebarGroupLabel>
            {totalCount > 0 && (
              <div className="mb-2 px-2" data-testid="tour-reading-progress">
                <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{lang === 'en' ? 'Reading progress' : '学习进度'}</span>
                  <span className="tabular-nums">
                    {visitedCount}
                    {' / '}
                    {totalCount}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={lang === 'en' ? 'Reading progress' : '学习进度'}
                  aria-valuemin={0}
                  aria-valuemax={totalCount}
                  aria-valuenow={visitedCount}
                  className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full rounded-full bg-brand transition-[width] duration-200 motion-reduce:transition-none"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}
            <SidebarMenu>
              {tourData.map(chapter => (
                <ActiveCollapsible
                  key={chapter.id}
                  active={chapter.id === currentChapter}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton>
                        <ChevronRight className="transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        <span className="font-medium">{chapter.name[lang] ?? chapter.name.zh}</span>
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {chapter.subChapters.map(sub => (
                          <ActiveCollapsible
                            key={sub.id}
                            active={chapter.id === currentChapter && sub.id === currentSubChapter}
                            className="group/sub"
                          >
                            <SidebarMenuSubItem>
                              <CollapsibleTrigger asChild>
                                <SidebarMenuButton className="text-sm">
                                  <ChevronRight className="h-3 w-3 transition-transform duration-200 group-data-[state=open]/sub:rotate-90" />
                                  <span>{sub.name[lang] ?? sub.name.zh}</span>
                                </SidebarMenuButton>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <SidebarMenuSub>
                                  {sub.sections.map((s) => {
                                    const sectionKey = buildTourSectionKey(chapter.id, sub.id, s.id)
                                    const isActive
                                      = chapter.id === currentChapter
                                        && sub.id === currentSubChapter
                                        && s.id === currentSection
                                    const isVisited = hydrated && Boolean(visitedSections[sectionKey])
                                    const title = s.name[lang] ?? s.name.zh

                                    return (
                                      <SidebarMenuSubItem key={s.id}>
                                        <SidebarMenuButton
                                          asChild={Boolean(sectionHref)}
                                          isActive={isActive}
                                          aria-current={isActive ? 'page' : undefined}
                                          data-visited={isVisited ? 'true' : undefined}
                                          className="cursor-pointer justify-between text-xs"
                                          onClick={(event) => {
                                            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
                                              return
                                            event.preventDefault()
                                            onNavigate(chapter.id, sub.id, s.id)
                                            if (isMobile)
                                              setOpenMobile(false)
                                          }}
                                        >
                                          {sectionHref
                                            ? (
                                                <a href={sectionHref(chapter.id, sub.id, s.id)} className="flex min-w-0 items-center justify-between gap-1.5">
                                                  <span className="truncate">{title}</span>
                                                  {isVisited && <CheckCircle2 aria-hidden="true" className="size-3.5 shrink-0 text-brand" />}
                                                </a>
                                              )
                                            : (
                                                <>
                                                  <span className="truncate">{title}</span>
                                                  {isVisited && <CheckCircle2 aria-hidden="true" className="size-3.5 shrink-0 text-brand" />}
                                                </>
                                              )}
                                        </SidebarMenuButton>
                                      </SidebarMenuSubItem>
                                    )
                                  })}
                                </SidebarMenuSub>
                              </CollapsibleContent>
                            </SidebarMenuSubItem>
                          </ActiveCollapsible>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </ActiveCollapsible>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </ScrollArea>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
