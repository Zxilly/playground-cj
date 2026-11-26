'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { ChevronDown, ChevronUp, Loader2, ShieldAlert } from 'lucide-react'
import type { WorkspaceView } from '@/features/teach/state/workspace-store'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import { useClassroomSnapshot } from '@/features/teach/hooks/use-classroom-snapshot'
import { LiveClassroomView } from './views/LiveClassroomView'

const ConceptProgressView = dynamic(
  () => import('./views/ConceptProgressView').then(module => module.ConceptProgressView),
  { loading: WorkspaceViewLoading },
)
const PlaygroundView = dynamic(
  () => import('./views/PlaygroundView').then(module => module.PlaygroundView),
  { loading: WorkspaceViewLoading },
)
const ReviewView = dynamic(
  () => import('./views/ReviewView').then(module => module.ReviewView),
  { loading: WorkspaceViewLoading },
)

function WorkspaceViewLoading() {
  const { lang } = useWorkspace()
  return (
    <div role="status" className="flex min-h-48 items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
      <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
      {lang === 'en' ? 'Loading view…' : '正在加载视图…'}
    </div>
  )
}

export function WorkspaceViewport({ view }: { view: WorkspaceView }) {
  const { classroom, lang } = useWorkspace()
  const snapshot = useClassroomSnapshot(classroom)
  const [noticeExpanded, setNoticeExpanded] = useState(false)
  const english = lang === 'en'
  const showExposureNotice = Boolean(snapshot.teacherExposureEpoch) && view !== 'playground'

  return (
    <>
      {showExposureNotice && (
        <aside
          role="status"
          data-testid="teacher-exposure-notice"
          className="mb-4 rounded-lg border border-amber-500/35 bg-amber-500/8 px-3.5 py-2.5 text-xs leading-5 text-foreground"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <ShieldAlert
                aria-hidden="true"
                className="size-4 shrink-0 text-amber-700 dark:text-amber-300"
              />
              <span className="font-medium">
                {english
                  ? 'Guided practice mode (teacher explanation viewed)'
                  : '当前为有指导练习模式（已查看老师讲解）'}
              </span>
            </div>
            <button
              type="button"
              aria-expanded={noticeExpanded}
              onClick={() => setNoticeExpanded(expanded => !expanded)}
              className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-amber-500/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {noticeExpanded
                ? (english ? 'Hide details' : '收起说明')
                : (english ? 'Details' : '详情')}
              {noticeExpanded
                ? <ChevronUp aria-hidden="true" className="size-3.5" />
                : <ChevronDown aria-hidden="true" className="size-3.5" />}
            </button>
          </div>
          {noticeExpanded && (
            <p className="mt-2 ps-6 text-xs leading-5 text-muted-foreground">
              {english
                ? 'You have viewed teacher explanations or guidance. Later answers are still useful for practice and feedback, but they are not treated as an independent check in this workspace.'
                : '你已查看老师讲解或指导。之后的作答仍可用于练习和反馈，但在这个工作区内不会被视为独立测验。'}
            </p>
          )}
        </aside>
      )}
      <WorkspaceViewContent view={view} />
    </>
  )
}

function WorkspaceViewContent({ view }: { view: WorkspaceView }) {
  switch (view) {
    case 'live':
      return <LiveClassroomView />
    case 'review':
      return <ReviewView />
    case 'progress':
      return <ConceptProgressView />
    case 'playground':
      return <PlaygroundView />
  }
}
