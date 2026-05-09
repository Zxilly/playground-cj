'use client'

import { useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import type { FlatSection } from '@/tour/types'
import { useEditorBridge } from '@/modules/cangjie-editor/context/useEditorBridge'
import { AIClassroomBridgeContext } from '@/features/tour-ai/context/ai-classroom-bridge-context'
import type { AIClassroomBridgeValue, AIClassroomStateBridge, UILang } from '@/lib/ai/classroom/bridge'

interface AIClassroomBridgeProviderProps {
  children: ReactNode
  allSections: FlatSection[]
  classroom?: AIClassroomStateBridge
}

export function AIClassroomBridgeProvider({
  children,
  allSections,
  classroom,
}: AIClassroomBridgeProviderProps) {
  const { editor, lang } = useEditorBridge()
  const uiLang: UILang = lang === 'en' ? 'en' : 'zh'

  const aliveRef = useRef(true)
  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  const guardedClassroom = useMemo<AIClassroomStateBridge | undefined>(() => {
    if (!classroom)
      return undefined
    return {
      getSession: () => classroom.getSession(),
      dispatch: (action) => {
        if (!aliveRef.current)
          return
        classroom.dispatch(action)
      },
      replaceChatAnnotations: (annotations) => {
        if (!aliveRef.current)
          return
        classroom.replaceChatAnnotations(annotations)
      },
      clearChatAnnotations: () => {
        if (!aliveRef.current)
          return
        classroom.clearChatAnnotations()
      },
    }
  }, [classroom])

  const value = useMemo<AIClassroomBridgeValue>(
    () => ({ editor, lang, uiLang, allSections, classroom: guardedClassroom }),
    [editor, lang, uiLang, allSections, guardedClassroom],
  )

  return (
    <AIClassroomBridgeContext value={value}>
      {children}
    </AIClassroomBridgeContext>
  )
}
