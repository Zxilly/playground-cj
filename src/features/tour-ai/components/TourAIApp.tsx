'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { FlatSection } from '@/tour/types'
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
import { usePersistentClassroomSession } from '@/lib/ai/classroom/use-persistent-session'
import { TourAIClassroomShell } from '@/features/tour-ai/components/TourAIClassroomShell'

interface TourAIAppProps {
  lang: string
  allSections: FlatSection[]
}

export default function TourAIApp({ lang, allSections }: TourAIAppProps) {
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
    <EditorBridgeProvider lang={lang}>
      <AIClassroomBridgeProvider allSections={allSections} classroom={classroom}>
        <TourAIClassroomShell
          lang={lang}
          allSections={allSections}
          session={session}
          dispatch={dispatch}
          hydrated={hydrated}
          annotationState={annotationState}
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
