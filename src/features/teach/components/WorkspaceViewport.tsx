import type { WorkspaceView } from '@/features/teach/state/workspace-store'
import { GlossaryView } from './views/GlossaryView'
import { LessonView } from './views/LessonView'
import { LessonsListView } from './views/LessonsListView'
import { MissionGate } from './views/MissionGate'
import { MissionView } from './views/MissionView'
import { NotesView } from './views/NotesView'
import { ProgressDashboardView } from './views/ProgressDashboardView'
import { RecordsView } from './views/RecordsView'
import { ReferenceView } from './views/ReferenceView'

export interface WorkspaceViewportProps {
  currentLessonId: string | null
  currentReferenceId: string | null
  missionReady: boolean
  view: WorkspaceView
}

/** Maps ephemeral navigation state to the central document surface. */
export function WorkspaceViewport({
  currentLessonId,
  currentReferenceId,
  missionReady,
  view,
}: WorkspaceViewportProps) {
  switch (view) {
    case 'overview':
      return <ProgressDashboardView />
    case 'mission':
      return <MissionView />
    case 'lessons':
      return missionReady ? <LessonsListView /> : <MissionGate />
    case 'lesson':
      return missionReady
        ? <LessonView key={currentLessonId ?? 'none'} lessonId={currentLessonId} />
        : <MissionGate />
    case 'glossary':
      return <GlossaryView />
    case 'reference':
      return <ReferenceView referenceId={currentReferenceId} />
    case 'records':
      return <RecordsView />
    case 'notes':
      return <NotesView />
  }
}
