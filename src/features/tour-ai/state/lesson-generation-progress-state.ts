import type { LessonGenerationProgressChunk, LessonGenerationProgressItem } from '@/lib/ai/lesson-generation-progress'

export type LessonGenerationProgressStatus = 'idle' | 'running' | 'completed' | 'failed'

export interface LessonGenerationProgressState {
  status: LessonGenerationProgressStatus
  expanded: boolean
  text: string
  items?: LessonGenerationProgressItem[]
}

export const EMPTY_LESSON_GENERATION_PROGRESS: LessonGenerationProgressState = {
  status: 'idle',
  expanded: false,
  text: '',
  items: [],
}

const MAX_GENERATION_PROGRESS_CHARS = 12000
const MAX_GENERATION_PROGRESS_ITEMS = 80

export function appendLessonGenerationProgress(
  state: LessonGenerationProgressState,
  chunk: LessonGenerationProgressChunk,
): LessonGenerationProgressState {
  if (!chunk)
    return state
  if (typeof chunk === 'string' || chunk.type === 'text')
    return appendTextProgress(state, typeof chunk === 'string' ? chunk : chunk.text)

  return appendToolProgress(state, chunk)
}

function appendTextProgress(state: LessonGenerationProgressState, chunk: string): LessonGenerationProgressState {
  if (!chunk)
    return state
  const text = `${state.text}${chunk}`.slice(-MAX_GENERATION_PROGRESS_CHARS)
  const items = appendTextItem(state.items ?? [], chunk)
  return {
    ...state,
    status: state.status === 'idle' ? 'running' : state.status,
    expanded: state.status === 'completed' ? state.expanded : true,
    text,
    items,
  }
}

function appendTextItem(items: LessonGenerationProgressItem[], text: string): LessonGenerationProgressItem[] {
  const next = [...items]
  const last = next.at(-1)
  if (last?.type === 'text') {
    next[next.length - 1] = {
      ...last,
      text: `${last.text}${text}`.slice(-MAX_GENERATION_PROGRESS_CHARS),
    }
  }
  else {
    next.push({
      id: `text-${next.length}`,
      type: 'text',
      text: text.slice(-MAX_GENERATION_PROGRESS_CHARS),
    })
  }
  return trimItems(next)
}

function appendToolProgress(
  state: LessonGenerationProgressState,
  chunk: Exclude<LessonGenerationProgressChunk, string | { type: 'text', text: string }>,
): LessonGenerationProgressState {
  const items = [...(state.items ?? [])]
  const existingIndex = items.findIndex(item => item.type === 'tool' && item.id === chunk.toolCallId)
  const status = chunk.type === 'tool-start'
    ? 'running'
    : chunk.type === 'tool-result' ? 'completed' : 'failed'
  const summary = chunk.type === 'tool-result'
    ? summarizeToolOutput(chunk.output)
    : chunk.type === 'tool-error' ? summarizeToolError(chunk.error) : undefined
  const toolItem: LessonGenerationProgressItem = {
    id: chunk.toolCallId,
    type: 'tool',
    toolName: chunk.toolName,
    status,
    ...(summary ? { summary } : {}),
  }

  if (existingIndex >= 0)
    items[existingIndex] = toolItem
  else
    items.push(toolItem)

  return {
    ...state,
    status: state.status === 'idle' ? 'running' : state.status,
    expanded: state.status === 'completed' ? state.expanded : true,
    items: trimItems(items),
  }
}

function trimItems(items: LessonGenerationProgressItem[]): LessonGenerationProgressItem[] {
  return items.slice(-MAX_GENERATION_PROGRESS_ITEMS)
}

function summarizeToolOutput(output: unknown): string | undefined {
  if (output == null)
    return undefined
  if (typeof output !== 'object')
    return String(output)

  const record = output as Record<string, unknown>
  if (record.ok === false && record.error)
    return String(record.error)
  if (typeof record.appended === 'number')
    return `已追加 ${record.appended} 个内容块`
  if (typeof record.currentQuiz === 'object' && record.currentQuiz !== null)
    return '已设置练习'
  if (record.phase)
    return `阶段：${String(record.phase)}`
  if (record.error)
    return String(record.error)
  if (record.ok === true)
    return '已完成'
  return undefined
}

function summarizeToolError(error: unknown): string | undefined {
  if (error == null)
    return undefined
  return error instanceof Error ? error.message : String(error)
}
