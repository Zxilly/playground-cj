export type LessonGenerationToolProgressStatus = 'running' | 'completed' | 'failed'

export type LessonGenerationProgressChunk
  = | string
    | { type: 'text', text: string }
    | { type: 'tool-start', toolCallId: string, toolName: string }
    | { type: 'tool-result', toolCallId: string, toolName: string, output?: unknown }
    | { type: 'tool-error', toolCallId: string, toolName: string, error?: unknown }

export type LessonGenerationProgressItem
  = | { id: string, type: 'text', text: string }
    | {
      id: string
      type: 'tool'
      toolName: string
      status: LessonGenerationToolProgressStatus
      summary?: string
    }
