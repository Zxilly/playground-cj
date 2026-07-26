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
              ? 'Teacher guidance is active. There is no verified fresh-assessment boundary, so every later attempt is recorded as aided and cannot produce independent evidence. This classroom never claims mastery without trusted assessment freshness.'
              : '教师引导已激活。当前没有已验证的 fresh-assessment boundary，因此之后所有 attempts 都会记为 aided，且不能产生 independent evidence；在没有可信评估新鲜度证明时，本课堂不会宣称 mastery。'}
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
