import type { Toolkit } from '@assistant-ui/react'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import { createLessonGenerationStateTools } from './classroom-state-tools'
import { createLessonOrchestratorTools } from './lesson-orchestrator-tools'
import { createMcpCallTool } from './mcp-tools'

export {
  evaluateLessonOrchestrationToolResult,
  getClassroomToolStatusMetadata,
  isLessonGenerationToolName,
  isLessonOrchestrationTool,
  LESSON_GENERATION_TOOL_NAMES,
  LESSON_MUTATING_TOOL_NAMES,
  LESSON_ORCHESTRATION_TOOL_NAMES,
} from './lesson-toolkit-metadata'
export type {
  ClassroomToolStatusCategory,
  ClassroomToolStatusLabelKey,
  ClassroomToolStatusMetadata,
  LessonGenerationToolName,
  LessonOrchestrationToolName,
  LessonOrchestrationToolResultEvaluation,
} from './lesson-toolkit-metadata'

export function createLessonGenerationToolkit(bridge: AIClassroomBridgeValue): Toolkit {
  return {
    ...createLessonGenerationStateTools(bridge),
    ...createMcpCallTool(),
    ...createLessonOrchestratorTools(bridge),
  }
}
