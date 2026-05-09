'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { EditorBridgeProvider } from '@/modules/cangjie-editor/context/EditorBridgeProvider'
import { AIClassroomBridgeProvider } from '@/features/tour-ai/context/AIClassroomBridgeProvider'
import { ClassroomThemeProvider } from '@/features/tour-ai/context/classroom-theme-context'
import type { ClassroomAction } from '@/lib/ai/classroom/reducer'
import type { ClassroomSession } from '@/lib/ai/classroom/types'
import {
  clearChatAnnotations as clearChatAnnotationState,
  createEditorAnnotationState,
  replaceChatAnnotations as replaceChatAnnotationState,
} from '@/lib/ai/classroom/editor-annotations'
import type { EditorAnnotationState, NewChatAnnotation } from '@/lib/ai/classroom/editor-annotations'
import { usePersistentClassroomSession } from '@/lib/ai/classroom/use-persistent-session'
import { TourAIClassroomShell } from '@/features/tour-ai/components/TourAIClassroomShell'

interface TourAIAppProps {
  lang: string
}

export default function TourAIApp({ lang }: TourAIAppProps) {
  const { session, dispatch, hydrated } = usePersistentClassroomSession({ lang })
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

  return (
    <ClassroomThemeProvider>
      <EditorBridgeProvider lang={lang}>
        <AIClassroomBridgeProvider classroom={classroom}>
          <TourAIClassroomShell
            lang={lang}
            session={session}
            dispatch={dispatch}
            hydrated={hydrated}
            annotationState={annotationState}
          />
        </AIClassroomBridgeProvider>
      </EditorBridgeProvider>
    </ClassroomThemeProvider>
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
