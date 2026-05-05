'use client'

import { useMemo } from 'react'
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
  const value = useMemo<AIClassroomBridgeValue>(
    () => ({ editor, lang, uiLang, allSections, classroom }),
    [editor, lang, uiLang, allSections, classroom],
  )

  return (
    <AIClassroomBridgeContext value={value}>
      {children}
    </AIClassroomBridgeContext>
  )
}
