'use client'

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

export function TourSidebar({
  lang,
  tourData,
  currentChapter,
  currentSubChapter,
  currentSection,
  onNavigate,
}: TourSidebarProps) {
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
                <Collapsible
                  key={chapter.id}
                  defaultOpen={chapter.id === currentChapter}
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
                          <Collapsible
                            key={sub.id}
                            defaultOpen={chapter.id === currentChapter && sub.id === currentSubChapter}
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
                                  {sub.sections.map((section) => {
                                    const isActive
                                      = chapter.id === currentChapter
                                        && sub.id === currentSubChapter
                                        && section.id === currentSection

                                    return (
                                      <SidebarMenuSubItem key={section.id}>
                                        <SidebarMenuButton
                                          isActive={isActive}
                                          className="text-xs cursor-pointer"
                                          onClick={() => onNavigate(chapter.id, sub.id, section.id)}
                                        >
                                          {section.name[lang] ?? section.name.zh}
                                        </SidebarMenuButton>
                                      </SidebarMenuSubItem>
                                    )
                                  })}
                                </SidebarMenuSub>
                              </CollapsibleContent>
                            </SidebarMenuSubItem>
                          </Collapsible>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </ScrollArea>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
