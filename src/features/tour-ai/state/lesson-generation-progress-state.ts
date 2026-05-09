export type LessonAuthorProgressStatus = 'idle' | 'running' | 'completed' | 'failed'

export interface LessonAuthorProgressState {
  status: LessonAuthorProgressStatus
  expanded: boolean
  text: string
}

export const EMPTY_AUTHOR_PROGRESS: LessonAuthorProgressState = {
  status: 'idle',
  expanded: false,
  text: '',
}

const MAX_AUTHOR_PROGRESS_CHARS = 12000

export function appendLessonAuthorProgress(state: LessonAuthorProgressState, chunk: string): LessonAuthorProgressState {
  if (!chunk)
    return state
  const text = `${state.text}${chunk}`.slice(-MAX_AUTHOR_PROGRESS_CHARS)
  return {
    ...state,
    status: state.status === 'idle' ? 'running' : state.status,
    expanded: state.status === 'completed' ? state.expanded : true,
    text,
  }
}
