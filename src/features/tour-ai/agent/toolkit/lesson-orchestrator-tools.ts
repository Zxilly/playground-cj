import type { Toolkit } from '@assistant-ui/react'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import { LESSON_ORCHESTRATION_COMMANDS } from './lesson-orchestration-commands'

export function createLessonOrchestratorTools(bridge: AIClassroomBridgeValue): Toolkit {
  return Object.fromEntries(
    LESSON_ORCHESTRATION_COMMANDS.map(command => [
      command.name,
      {
        description: command.description,
        parameters: command.parameters,
        execute: (input: unknown) => command.execute(bridge, input),
      },
    ]),
  )
}
