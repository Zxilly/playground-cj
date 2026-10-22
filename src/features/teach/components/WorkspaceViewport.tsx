'use client'

import dynamic from 'next/dynamic'
import { Loader2, ShieldAlert } from 'lucide-react'
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
  const english = lang === 'en'

  return (
    <>
      {snapshot.teacherExposureEpoch && (
        <aside
          role="status"
          className="mb-5 flex gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm leading-6 text-foreground"
        >
          <ShieldAlert
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300"
          />
          <p>
            {english
              ? 'You have viewed teacher explanations or guidance. Later answers are still useful for practice and feedback, but they are not treated as an independent check in this workspace.'
              : '你已查看老师讲解或指导。之后的作答仍可用于练习和反馈，但在这个工作区内不会被视为独立测验。'}
          </p>
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
