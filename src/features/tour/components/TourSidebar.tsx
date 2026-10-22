'use client'

import { useState } from 'react'
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
import { ChevronRight } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import type { TourChapterSlim } from '@/tour/types'

interface TourSidebarProps {
  lang: string
  tourData: TourChapterSlim[]
  currentChapter: string
  currentSubChapter: string
  currentSection: string
  onNavigate: (chapterId: string, subChapterId: string, sectionId: string) => void
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
}: TourSidebarProps) {
  const { isMobile, setOpenMobile } = useSidebar()

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarContent>
        <ScrollArea className="h-full">
          <SidebarGroup>
            <SidebarGroupLabel className="text-tour-accent-fg font-semibold">
              <Trans>仓颉之旅</Trans>
            </SidebarGroupLabel>
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
                                    const isActive
                                      = chapter.id === currentChapter
                                        && sub.id === currentSubChapter
                                        && s.id === currentSection

                                    return (
                                      <SidebarMenuSubItem key={s.id}>
                                        <SidebarMenuButton
                                          isActive={isActive}
                                          aria-current={isActive ? 'page' : undefined}
                                          className="text-xs cursor-pointer"
                                          onClick={() => {
                                            onNavigate(chapter.id, sub.id, s.id)
                                            if (isMobile)
                                              setOpenMobile(false)
                                          }}
                                        >
                                          {s.name[lang] ?? s.name.zh}
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
