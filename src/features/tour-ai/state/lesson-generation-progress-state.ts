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
  lang = 'zh',
): LessonGenerationProgressState {
  if (!chunk)
    return state
  if (typeof chunk === 'string' || chunk.type === 'text')
    return appendTextProgress(state, typeof chunk === 'string' ? chunk : chunk.text)
  if (chunk.type === 'reasoning')
    return appendReasoningProgress(state, chunk.reasoningId, chunk.text)

  return appendToolProgress(state, chunk, lang)
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

function appendReasoningProgress(
  state: LessonGenerationProgressState,
  reasoningId: string,
  chunk: string,
): LessonGenerationProgressState {
  if (!chunk)
    return state
  const items = [...(state.items ?? [])]
  const last = items.at(-1)
  // Only fold into the trailing reasoning item when it came from the same
  // reasoning channel. Some models reuse the same reasoning id across multiple
  // bursts separated by tool calls; we must NOT append back to the earlier
  // item in that case, or the UI collapses chronologically-distinct thoughts
  // into one block and loses the interleaving with tools.
  if (last?.type === 'reasoning' && last.reasoningKey === reasoningId) {
    items[items.length - 1] = {
      ...last,
      text: `${last.text}${chunk}`.slice(-MAX_GENERATION_PROGRESS_CHARS),
    }
  }
  else {
    items.push({
      id: `reasoning-${reasoningId}-${items.length}`,
      reasoningKey: reasoningId,
      type: 'reasoning',
      text: chunk.slice(-MAX_GENERATION_PROGRESS_CHARS),
    })
  }
  return {
    ...state,
    status: state.status === 'idle' ? 'running' : state.status,
    expanded: state.status === 'completed' ? state.expanded : true,
    items: trimItems(items),
  }
}

function appendToolProgress(
  state: LessonGenerationProgressState,
  // Narrow positively to the three tool-shaped chunks. The dispatcher in
  // appendLessonGenerationProgress has already returned for text + reasoning
  // variants by the time we get here, so the union we receive is only the
  // tool-* members — name them explicitly so TS can resolve `toolCallId` and
  // `toolName` below without union-membership errors.
  chunk: Extract<LessonGenerationProgressChunk, { type: 'tool-start' | 'tool-result' | 'tool-error' }>,
  lang: string,
): LessonGenerationProgressState {
  const items = [...(state.items ?? [])]
  const existingIndex = items.findIndex(item => item.type === 'tool' && item.id === chunk.toolCallId)
  const status = chunk.type === 'tool-start'
    ? 'running'
    : chunk.type === 'tool-result' ? 'completed' : 'failed'
  const summary = chunk.type === 'tool-result'
    ? summarizeToolOutput(chunk.toolName, chunk.output, lang)
    : chunk.type === 'tool-error' ? summarizeToolError(chunk.error, lang) : undefined
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

function summarizeToolOutput(toolName: string, output: unknown, lang: string): string | undefined {
  if (output == null)
    return undefined
  if (typeof output !== 'object')
    return lang === 'en' ? 'Completed' : '已完成'

  const record = output as Record<string, unknown>
  if (record.ok === false && record.error)
    return lang === 'en' ? 'This step did not complete.' : '这一步未完成'
  if (typeof record.appended === 'number') {
    return lang === 'en'
      ? 'Content prepared'
      : '讲解内容已准备'
  }
  if (toolName === 'append_bridge_note')
    return lang === 'en' ? 'Path note added' : '路径说明已加入'
  if (toolName === 'append_skip_marker')
    return lang === 'en' ? 'Skipped content recorded' : '跳过内容已记录'
  if (toolName === 'create_exercise_instance')
    return lang === 'en' ? 'Exercise prepared' : '练习题已准备'
  if (toolName === 'save_clarification')
    return lang === 'en' ? 'Review note saved' : '复习说明已保存'
  if (toolName === 'save_remediation')
    return lang === 'en' ? 'Practice hint saved' : '练习提示已保存'
  if (typeof record.currentExercise === 'object' && record.currentExercise !== null)
    return lang === 'en' ? 'Exercise set' : '已设置练习'
  if (record.phase)
    return lang === 'en' ? 'Classroom updated' : '课堂已更新'
  if (record.error)
    return lang === 'en' ? 'This step did not complete.' : '这一步未完成'
  if (record.ok === true)
    return lang === 'en' ? 'Completed' : '已完成'
  return undefined
}

function summarizeToolError(_error: unknown, lang: string): string | undefined {
  return lang === 'en' ? 'This step did not complete.' : '这一步未完成'
}
