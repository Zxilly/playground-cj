'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorBridgeProvider } from '@/modules/cangjie-editor/context/EditorBridgeProvider'
import { AIClassroomBridgeProvider } from '@/features/tour-ai/context/AIClassroomBridgeProvider'
import type { ClassroomAction } from '@/lib/ai/classroom/reducer'
import type { ClassroomSession } from '@/lib/ai/classroom/types'
import {
  clearChatAnnotations as clearChatAnnotationState,
  createEditorAnnotationState,
  replaceChatAnnotations as replaceChatAnnotationState,
} from '@/lib/ai/classroom/editor-annotations'
import type { EditorAnnotationState, NewChatAnnotation } from '@/lib/ai/classroom/editor-annotations'
import type { ClassroomSessionHydrationIssue, ClassroomSessionSaveIssue } from '@/lib/ai/classroom/use-persistent-session'
import { TourAIClassroomShell } from '@/features/tour-ai/components/TourAIClassroomShell'
import { useCodeSuggestionStore } from '@/features/tour-ai/state/code-suggestion-store'
import { useExerciseDraftStore } from '@/features/tour-ai/state/exercise-draft-store'
import { useScrollWatermarkStore } from '@/features/tour-ai/state/scroll-watermark-store'

interface TourAIClassroomExperienceProps {
  lang: string
  session: ClassroomSession
  dispatch: React.Dispatch<ClassroomAction>
  hydrated: boolean
  hydrationIssue: ClassroomSessionHydrationIssue | null
  saveIssue: ClassroomSessionSaveIssue | null
  onTemporarySessionUse: () => void
  onRetrySave: () => Promise<void> | void
  onResetSession: () => void
  initialTopic?: string
  initialLandingAccepted?: boolean
  initialPreviewOnly?: boolean
}

export default function TourAIClassroomExperience({
  lang,
  session,
  dispatch,
  hydrated,
  hydrationIssue,
  saveIssue,
  onTemporarySessionUse,
  onRetrySave,
  onResetSession,
  initialTopic,
  initialLandingAccepted = true,
  initialPreviewOnly = false,
}: TourAIClassroomExperienceProps) {
  const sessionRef = useRef(session)
  const [annotationState, setAnnotationState] = useState<EditorAnnotationState>(() => createEditorAnnotationState())

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  const classroom = useMemo(() => createClassroomBridge({
    getSession: () => sessionRef.current,
    dispatch,
    setAnnotationState,
  }), [dispatch])
  const resetClassroom = useCallback(() => {
    useExerciseDraftStore.getState().clearAll()
    useCodeSuggestionStore.getState().clearAll()
    useScrollWatermarkStore.getState().clearAll()
    setAnnotationState(createEditorAnnotationState())
    onResetSession()
  }, [onResetSession])

  return (
    <EditorBridgeProvider lang={lang}>
      <AIClassroomBridgeProvider classroom={classroom}>
        <TourAIClassroomShell
          lang={lang}
          session={session}
          dispatch={dispatch}
          hydrated={hydrated}
          hydrationIssue={hydrationIssue}
          saveIssue={saveIssue}
          onTemporarySessionUse={onTemporarySessionUse}
          onRetrySave={onRetrySave}
          onResetSession={resetClassroom}
          annotationState={annotationState}
          initialTopic={initialTopic}
          initialLandingAccepted={initialLandingAccepted}
          initialPreviewOnly={initialPreviewOnly}
        />
      </AIClassroomBridgeProvider>
    </EditorBridgeProvider>
  )
}

function createClassroomBridge({
  getSession,
  dispatch,
  setAnnotationState,
}: {
  getSession: () => ClassroomSession
  dispatch: (action: ClassroomAction) => void
  setAnnotationState: React.Dispatch<React.SetStateAction<EditorAnnotationState>>
}) {
  return {
    getSession,
    dispatch,
    replaceChatAnnotations: (annotations: NewChatAnnotation[]) => {
      setAnnotationState(state => replaceChatAnnotationState(state, annotations))
    },
    clearChatAnnotations: () => {
      setAnnotationState(state => clearChatAnnotationState(state))
    },
  }
}
