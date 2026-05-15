import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import type { Toolkit } from '@assistant-ui/react'
import type { ClassroomEvent } from './classroom/types'
import { createLessonGeneration, createLessonGenerationEventEnvelope, isLessonAuthoringTool } from './lesson-generation'
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

  let hadToolFailure = false
  let hadAuthoringSuccess = false
  let firstErrorDetail: string | undefined

  function recordFailure(detail: unknown) {
    hadToolFailure = true
    if (firstErrorDetail !== undefined || detail === undefined)
      return
    firstErrorDetail = detail instanceof Error ? detail.message : String(detail)
  }

  for await (const part of stream.fullStream) {
    if (abortSignal?.aborted)
      return
    if (part.type === 'text-delta') {
      reportProgress(onProgress, { type: 'text', text: part.text })
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
      if (isLessonAuthoringTool(toolName)) {
        const output = part.output
        if (output && typeof output === 'object' && (output as { ok?: unknown }).ok === true) {
          hadAuthoringSuccess = true
        }
        else {
          // failWithRetryHint returns { ok: false } as a successful tool-result — count as failure for guard purposes.
          recordFailure((output as { error?: unknown } | undefined)?.error)
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
      recordFailure(part.error)
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
      recordFailure(errPart.errorText)
    }
  }

  if (!hadAuthoringSuccess) {
    const failureContext = hadToolFailure ? ' after tool failures' : ''
    throw new Error(`Lesson generation produced no authoring output${failureContext}${firstErrorDetail ? `: ${firstErrorDetail}` : ''}`)
  }
}

function reportProgress(onProgress: LessonGenerationRunnerOptions['onProgress'], chunk: LessonGenerationProgressChunk) {
  if (!chunk || (typeof chunk !== 'string' && chunk.type === 'text' && !chunk.text))
    return
  onProgress?.(chunk)
}
