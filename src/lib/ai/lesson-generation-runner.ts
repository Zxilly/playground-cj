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

function isAuthoringTool(name: string): boolean {
  return name.startsWith('append_') || name === 'set_current_quiz'
}

export async function runLessonGenerationStep({ config, toolkit, event, abortSignal, onProgress }: LessonGenerationRunnerOptions): Promise<void> {
  if (!config.apiKey)
    return

  const generation = createLessonGeneration(config, toolkit)
  const stream = await generation.stream({
    prompt: JSON.stringify(createLessonGenerationEventEnvelope(event)),
    abortSignal,
  })

  let hadToolError = false
  let hadAuthoringSuccess = false
  let lastErrorDetail: string | undefined

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
      if (isAuthoringTool(toolName)) {
        // Only count as authoring success if the tool returned ok:true.
        // failWithRetryHint returns { ok: false, error, expectedShape } and
        // is delivered as a tool-result (not tool-error), so we must
        // distinguish based on the payload.
        const output = (part as { output?: unknown, result?: unknown }).output
          ?? (part as { result?: unknown }).result
        if (output && typeof output === 'object' && (output as { ok?: unknown }).ok === true) {
          hadAuthoringSuccess = true
        }
      }
    }
    else if (part.type === 'tool-error' || (part as { type: string }).type === 'tool-input-error') {
      const toolName = String((part as { toolName?: unknown }).toolName)
      reportProgress(onProgress, t`工具失败：${toolName}\n`)
      // Do NOT throw mid-stream — let the agent loop continue so the LLM can
      // self-correct on the next iteration via the tool result's
      // expectedShape feedback. Persistent failure is handled post-stream.
      hadToolError = true
      const detail = (part as { error?: unknown }).error
        ?? (part as { errorText?: unknown }).errorText
      if (detail !== undefined)
        lastErrorDetail = detail instanceof Error ? detail.message : String(detail)
    }
  }

  if (hadToolError && !hadAuthoringSuccess) {
    throw new Error(`Lesson generation produced no authoring output after tool failures${lastErrorDetail ? `: ${lastErrorDetail}` : ''}`)
  }
}

function reportProgress(onProgress: LessonGenerationRunnerOptions['onProgress'], chunk: string) {
  if (!chunk)
    return
  onProgress?.(chunk)
}
