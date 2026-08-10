'use client'

import { ShieldAlert } from 'lucide-react'
import type { WorkspaceView } from '@/features/teach/state/workspace-store'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import { useClassroomSnapshot } from '@/features/teach/hooks/use-classroom-snapshot'
import { ConceptProgressView } from './views/ConceptProgressView'
import { LiveClassroomView } from './views/LiveClassroomView'
import { PlaygroundView } from './views/PlaygroundView'
import { ReviewView } from './views/ReviewView'

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
