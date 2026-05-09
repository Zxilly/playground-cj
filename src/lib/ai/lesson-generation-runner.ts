import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import { createLessonAuthorAgent, createLessonAuthorEventEnvelope } from './lesson-author-agent'
import type { ClassroomEvent } from './classroom/types'
import type { LLMConfig } from './model-provider'
import type { Toolkit } from '@assistant-ui/react'

interface LessonAuthorRunnerOptions {
  config: Partial<LLMConfig>
  toolkit: Toolkit
  bridge: AIClassroomBridgeValue
  event: ClassroomEvent
  abortSignal?: AbortSignal
  onProgress?: (chunk: string) => void
}

export async function runLessonAuthorStep({ config, toolkit, event, abortSignal, onProgress }: LessonAuthorRunnerOptions): Promise<void> {
  if (!config.apiKey)
    return

  const agent = createLessonAuthorAgent(config, toolkit)
  const stream = await agent.stream({
    prompt: JSON.stringify(createLessonAuthorEventEnvelope(event)),
    abortSignal,
  })

  for await (const part of stream.fullStream) {
    if (abortSignal?.aborted)
      return
    if (part.type === 'text-delta') {
      reportProgress(onProgress, part.text)
    }
    else if (part.type === 'tool-input-start') {
      reportProgress(onProgress, `\n调用工具：${part.toolName}\n`)
    }
    else if (part.type === 'tool-result') {
      reportProgress(onProgress, `完成工具：${String(part.toolName)}\n`)
    }
    else if (part.type === 'tool-error') {
      reportProgress(onProgress, `工具失败：${String(part.toolName)}\n`)
    }
  }
}

function reportProgress(onProgress: LessonAuthorRunnerOptions['onProgress'], chunk: string) {
  if (!chunk)
    return
  onProgress?.(chunk)
}
