'use client'

import { useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import type { FlatSection } from '@/tour/types'
import { useAIClassroomBridge } from '@/features/tour-ai/context/useAIClassroomBridge'
import { harmonyFont, jetbrainsFont } from '@/app/font'
import { cn, isDarkMode } from '@/lib/utils'
import type { ClassroomAction } from '@/lib/ai/classroom/reducer'
import type { ClassroomSession } from '@/lib/ai/classroom/types'
import type { EditorAnnotationState } from '@/lib/ai/classroom/editor-annotations'
import { aiClassroomStyles } from '@/features/tour-ai/styles/ai-classroom-design'
import { AuthorErrorRetry } from '@/features/tour-ai/components/AuthorErrorRetry'
import { ClassroomStream } from '@/features/tour-ai/components/ClassroomStream'
import { LessonAuthorProgressPanel } from '@/features/tour-ai/components/LessonAuthorProgressPanel'
import { TourAIChat } from '@/features/tour-ai/components/TourAIChat'
import { textFor } from '@/features/tour-ai/utils/classroom-text'
import { useLessonAuthorRuntime } from '@/features/tour-ai/runtime/useLessonAuthorRuntime'

interface TourAIClassroomShellProps {
  lang: string
  allSections: FlatSection[]
  session: ClassroomSession
  dispatch: React.Dispatch<ClassroomAction>
  hydrated: boolean
  annotationState: EditorAnnotationState
}

export function TourAIClassroomShell({
  lang,
  allSections,
  session,
  dispatch,
  hydrated,
  annotationState,
}: TourAIClassroomShellProps) {
  const bridge = useAIClassroomBridge()
  const [chatOpen, setChatOpen] = useState(false)
  const currentSection = allSections[0]
  const {
    authorProgress,
    authorRunning,
    retryQueuedAuthorEvent,
    toggleAuthorProgress,
  } = useLessonAuthorRuntime({
    lang,
    currentSection,
    session,
    dispatch,
    hydrated,
  })

  if (!currentSection)
    return null

  return (
    <div
      data-testid="ai-classroom-root"
      className={cn(aiClassroomStyles.layout.root, isDarkMode() && 'dark')}
      style={{
        'fontFamily': `${harmonyFont.style.fontFamily}, sans-serif`,
        '--tour-code-font': `${jetbrainsFont.style.fontFamily}, monospace`,
      } as React.CSSProperties}
    >
      <div className={aiClassroomStyles.layout.shell}>
        <main className={aiClassroomStyles.layout.main}>
          <header data-testid="ai-classroom-header" className={aiClassroomStyles.header.root}>
            <div className={aiClassroomStyles.header.content}>
              <div className={aiClassroomStyles.header.brandMark}>仓</div>
              <div className={aiClassroomStyles.header.title}>AI Mode Classroom</div>
              <span className={aiClassroomStyles.header.subtitle}>{textFor(lang, currentSection.sectionName)}</span>
              <span data-testid="classroom-phase" className={aiClassroomStyles.badge.phase}>
                {session.phase}
              </span>
            </div>
            <button
              type="button"
              aria-label="打开 ChatAgent"
              onClick={() => setChatOpen(true)}
              className={aiClassroomStyles.button.secondary}
            >
              <MessageCircle className="size-4" />
              ChatAgent
            </button>
          </header>

          <div className={aiClassroomStyles.layout.viewport}>
            <div className={aiClassroomStyles.layout.content}>
              <section className={aiClassroomStyles.layout.sectionIntro}>
                <div className={aiClassroomStyles.text.eyebrow}>Continuous Classroom Stream</div>
                <h1 className={aiClassroomStyles.text.pageTitle}>{textFor(lang, currentSection.sectionName)}</h1>
              </section>

              <ClassroomStream session={session} lang={lang} dispatch={dispatch} bridge={bridge} />

              <LessonAuthorProgressPanel
                progress={authorProgress}
                visible={session.pendingAction === 'lesson_author' || authorRunning || authorProgress.status !== 'idle'}
                onToggle={toggleAuthorProgress}
              />

              {annotationState.annotations.some(annotation => annotation.namespace === 'chat' && annotation.stale) && (
                <div className={cn(aiClassroomStyles.text.warning, 'mt-3')}>ChatAgent 标注已过期</div>
              )}

              <AuthorErrorRetry session={session} onRetry={retryQueuedAuthorEvent} />
            </div>
          </div>
        </main>

        {chatOpen && (
          <aside className={aiClassroomStyles.layout.sidebar}>
            <div className={aiClassroomStyles.header.sidebarHeader}>
              <div className={aiClassroomStyles.text.label}>ChatAgent</div>
              <button
                type="button"
                aria-label="关闭 ChatAgent"
                onClick={() => setChatOpen(false)}
                className={aiClassroomStyles.button.icon}
              >
                <X className="size-4" />
              </button>
            </div>
            <div className={aiClassroomStyles.layout.sidebarBody}>
              <TourAIChat />
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
