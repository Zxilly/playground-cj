'use client'

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { isDarkMode } from '@/lib/utils'
import { harmonyFont, jetbrainsFont } from '@/app/font'
import { useMedia } from 'react-use'
import type { FlatSection } from '@/tour/types'
import { AIBridgeProvider } from '@/components/tour/EditorBridgeContext'
import { TourEditor } from '@/components/tour/TourEditor'
import { TourHeader } from '@/components/tour/TourHeader'
import { TourAIChat } from '@/components/tour/ai/TourAIChat'

interface TourAIAppProps {
  lang: string
  allSections: FlatSection[]
}

export default function TourAIApp({ lang, allSections }: TourAIAppProps) {
  const isDesktop = useMedia('(min-width: 1024px)')

  return (
    <AIBridgeProvider lang={lang} allSections={allSections}>
      <div
        className={`h-screen ${isDarkMode() ? 'dark' : ''}`}
        style={{
          'fontFamily': `${harmonyFont.style.fontFamily}, sans-serif`,
          '--tour-code-font': `${jetbrainsFont.style.fontFamily}, monospace`,
        } as React.CSSProperties}
      >
        <div className="flex flex-col h-full bg-background text-foreground">
          <TourHeader lang={lang} aiMode />
          <div className="flex-1 min-h-0 pt-1">
            {isDesktop
              ? (
                  <ResizablePanelGroup orientation="horizontal" className="h-full">
                    <ResizablePanel defaultSize={38} minSize={25}>
                      <TourAIChat />
                    </ResizablePanel>
                    <ResizableHandle withHandle className="bg-tour-border/80" />
                    <ResizablePanel defaultSize={62} minSize={30}>
                      <TourEditor code="" locale={lang} />
                    </ResizablePanel>
                  </ResizablePanelGroup>
                )
              : (
                  <div className="flex flex-col h-full overflow-auto">
                    <div className="h-[50vh] shrink-0">
                      <TourAIChat />
                    </div>
                    <div className="h-[50vh] shrink-0 border-t border-border">
                      <TourEditor code="" locale={lang} />
                    </div>
                  </div>
                )}
          </div>
        </div>
      </div>
    </AIBridgeProvider>
  )
}
