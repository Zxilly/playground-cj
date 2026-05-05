'use client'

import { use } from 'react'
import { AIClassroomBridgeContext } from '@/features/tour-ai/context/ai-classroom-bridge-context'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'

export function useAIClassroomBridge(): AIClassroomBridgeValue {
  const context = use(AIClassroomBridgeContext)
  if (!context)
    throw new Error('useAIClassroomBridge must be used within <AIClassroomBridgeProvider>')
  return context
}
