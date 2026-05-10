import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import { t } from '@lingui/core/macro'
import { createLessonGeneration, createLessonGenerationEventEnvelope } from './lesson-generation'
import type { ClassroomEvent } from './classroom/types'
import type { LLMConfig } from './model-provider'
import type { Toolkit } from '@assistant-ui/react'

interface LessonGenerationRunnerOptions {
  config: Partial<LLMConfig>
  toolkit: Toolkit
  bridge: AIClassroomBridgeValue
  event: ClassroomEvent
  abortSignal?: AbortSignal
  onProgress?: (chunk: string) => void
}

export async function runLessonGenerationStep({ config, toolkit, event, abortSignal, onProgress }: LessonGenerationRunnerOptions): Promise<void> {
  if (!config.apiKey)
    return

  const generation = createLessonGeneration(config, toolkit)
  const stream = await generation.stream({
    prompt: JSON.stringify(createLessonGenerationEventEnvelope(event)),
    abortSignal,
  })

  for await (const part of stream.fullStream) {
    if (abortSignal?.aborted)
      return
    if (part.type === 'text-delta') {
      reportProgress(onProgress, part.text)
    }
    else if (part.type === 'tool-input-start') {
      const toolName = String(part.toolName)
      reportProgress(onProgress, t`\n调用工具：${toolName}\n`)
    }
    else if (part.type === 'tool-result') {
      const toolName = String(part.toolName)
      reportProgress(onProgress, t`完成工具：${toolName}\n`)
    }
    else if (part.type === 'tool-error' || (part as { type: string }).type === 'tool-input-error') {
      const toolName = String((part as { toolName?: unknown }).toolName)
      reportProgress(onProgress, t`工具失败：${toolName}\n`)
      // Do NOT throw — let the agent loop continue so the LLM can self-correct
      // on the next iteration via the tool result's expectedShape feedback.
    }
  }
}

function reportProgress(onProgress: LessonGenerationRunnerOptions['onProgress'], chunk: string) {
  if (!chunk)
    return
  onProgress?.(chunk)
}
