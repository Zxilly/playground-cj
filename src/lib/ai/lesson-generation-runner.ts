import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import type { Toolkit } from '@assistant-ui/react'
import type { ClassroomEvent } from './classroom/types'
import { evaluateLessonOrchestrationToolResult } from '@/features/tour-ai/agent/toolkit/lesson-toolkit-metadata'
import { createLessonGeneration, createLessonGenerationEventEnvelope } from './lesson-generation'
import type { LessonGenerationProgressChunk } from './lesson-generation-progress'
import type { LLMConfig } from './model-provider'

interface LessonGenerationRunnerOptions {
  config: Partial<LLMConfig>
  toolkit: Toolkit
  bridge: AIClassroomBridgeValue
  event: ClassroomEvent
  abortSignal?: AbortSignal
  onProgress?: (chunk: LessonGenerationProgressChunk) => void
}

export async function runLessonGenerationStep({ config, toolkit, bridge, event, abortSignal, onProgress }: LessonGenerationRunnerOptions): Promise<void> {
  if (!config.apiKey)
    return

  const generation = createLessonGeneration(config, toolkit, bridge.lang)
  const stream = await generation.stream({
    prompt: JSON.stringify(createLessonGenerationEventEnvelope(event)),
    abortSignal,
  })

  let hadOrchestrationSuccess = false

  for await (const part of stream.fullStream) {
    if (abortSignal?.aborted)
      return
    if (part.type === 'text-delta') {
      // Free-form orchestration text is model scratch/status output, not a
      // stable learner-facing UI string. The progress panel only surfaces
      // fixed labels derived from tool activity.
    }
    else if (part.type === 'reasoning-delta') {
      // Never surface reasoning text in the learner UI.
    }
    else if (part.type === 'tool-input-start') {
      const toolName = part.toolName
      reportProgress(onProgress, {
        type: 'tool-start',
        toolCallId: part.id,
        toolName,
      })
    }
    else if (part.type === 'tool-result') {
      const toolName = part.toolName
      reportProgress(onProgress, {
        type: 'tool-result',
        toolCallId: part.toolCallId,
        toolName,
        output: part.output,
      })
      const orchestrationResult = evaluateLessonOrchestrationToolResult(toolName, part.output)
      if (orchestrationResult.orchestration) {
        if (orchestrationResult.succeeded) {
          hadOrchestrationSuccess = true
        }
        else {
          // ToolLoopAgent can self-correct after failed tool calls. Keep
          // consuming the stream, but do not surface raw tool failure details.
        }
      }
    }
    else if (part.type === 'tool-error') {
      const toolName = part.toolName
      const toolErrorPart = part as unknown as { toolCallId?: string, id?: string }
      reportProgress(onProgress, {
        type: 'tool-error',
        toolCallId: toolErrorPart.toolCallId ?? toolErrorPart.id ?? `${toolName}:error`,
        toolName,
        error: part.error,
      })
      // Don't throw mid-stream; ToolLoopAgent re-feeds the error so LLM can self-correct.
      // Keep consuming the stream; the model may recover with a later tool call.
    }
    else if ((part as { type: string }).type === 'tool-input-error') {
      // tool-input-error is emitted on UI/full-message streams but not on the typed fullStream union; narrow by cast.
      const errPart = part as unknown as { toolName: string, errorText: string }
      const toolName = errPart.toolName
      reportProgress(onProgress, {
        type: 'tool-error',
        toolCallId: (part as unknown as { id?: string }).id ?? `${toolName}:input-error`,
        toolName,
        error: errPart.errorText,
      })
      // Keep consuming the stream; the model may recover with a later tool call.
    }
    else if ((part as { type: string }).type === 'error') {
      // Stream-level errors (e.g. provider HTTP failures like new-api 403 insufficient_user_quota)
      // arrive as their own part instead of throwing from the iterator. Re-throw so the caller sees
      // the original APICallError-shaped error and can classify it — otherwise the loop completes
      // silently and we fall through to the generic "produced no orchestration output" message.
      const errPart = part as unknown as { error?: unknown }
      const raw = errPart.error
      throw raw instanceof Error ? raw : new Error(typeof raw === 'string' ? raw : JSON.stringify(raw))
    }
  }

  if (!hadOrchestrationSuccess) {
    throw new Error('lesson_generation_failed')
  }
}

function reportProgress(onProgress: LessonGenerationRunnerOptions['onProgress'], chunk: LessonGenerationProgressChunk) {
  if (!chunk)
    return
  if (typeof chunk !== 'string') {
    if ((chunk.type === 'text' || chunk.type === 'reasoning') && !chunk.text)
      return
  }
  onProgress?.(chunk)
}
