import { createContext } from 'react'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'

export const AIClassroomBridgeContext = createContext<AIClassroomBridgeValue | null>(null)
