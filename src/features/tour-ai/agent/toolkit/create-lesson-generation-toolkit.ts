import type { Toolkit } from '@assistant-ui/react'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import { createLessonGenerationStateTools } from './classroom-state-tools'
import { createLessonAuthoringTools } from './lesson-authoring-tools'
import { createMcpCallTool } from './mcp-tools'

export function createLessonGenerationToolkit(bridge: AIClassroomBridgeValue): Toolkit {
  return {
    ...createLessonGenerationStateTools(bridge),
    ...createMcpCallTool(),
    ...createLessonAuthoringTools(bridge),
  }
}
