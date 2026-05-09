export type EditorAnnotationNamespace = 'chat' | 'compiler'
export type EditorAnnotationKind = 'highlight' | 'underline'

export interface EditorAnnotation {
  namespace: EditorAnnotationNamespace
  kind: EditorAnnotationKind
  startLine: number
  endLine: number
  label?: string
  modelVersionId: number
  targetSnippet: string
  stale: boolean
}

export interface NewChatAnnotation {
  kind: EditorAnnotationKind
  startLine: number
  endLine?: number
  label?: string
  modelVersionId: number
  targetSnippet: string
}

export interface EditorAnnotationState {
  annotations: EditorAnnotation[]
}

export interface EditorEditSnapshot {
  modelVersionId: number
  lineCount: number
  getLineText: (line: number) => string
}

const SNIPPET_SEARCH_WINDOW = 5

export function createEditorAnnotationState(annotations: EditorAnnotation[] = []): EditorAnnotationState {
  return { annotations }
}

export function replaceChatAnnotations(state: EditorAnnotationState, next: NewChatAnnotation[]): EditorAnnotationState {
  return {
    annotations: [
      ...state.annotations.filter(annotation => annotation.namespace !== 'chat'),
      ...next.map(annotation => ({
        namespace: 'chat' as const,
        kind: annotation.kind,
        startLine: annotation.startLine,
        endLine: annotation.endLine ?? annotation.startLine,
        label: annotation.label,
        modelVersionId: annotation.modelVersionId,
        targetSnippet: annotation.targetSnippet,
        stale: false,
      })),
    ],
  }
}

export function clearChatAnnotations(state: EditorAnnotationState): EditorAnnotationState {
  return {
    annotations: state.annotations.filter(annotation => annotation.namespace !== 'chat'),
  }
}

function findSnippetNearby(
  snapshot: EditorEditSnapshot,
  centerLine: number,
  snippet: string,
): number | null {
  const start = Math.max(1, centerLine - SNIPPET_SEARCH_WINDOW)
  const end = Math.min(snapshot.lineCount, centerLine + SNIPPET_SEARCH_WINDOW)
  for (let line = start; line <= end; line++) {
    if (snapshot.getLineText(line).includes(snippet))
      return line
  }
  return null
}

export function refreshChatAnnotationsAfterEdit(
  state: EditorAnnotationState,
  snapshot: EditorEditSnapshot,
): EditorAnnotationState {
  return {
    annotations: state.annotations.map((annotation) => {
      if (annotation.namespace !== 'chat' || annotation.stale)
        return annotation
      if (annotation.modelVersionId === snapshot.modelVersionId)
        return annotation

      const found = findSnippetNearby(snapshot, annotation.startLine, annotation.targetSnippet)
      if (found == null)
        return { ...annotation, stale: true }

      const lineDelta = found - annotation.startLine
      return {
        ...annotation,
        startLine: found,
        endLine: annotation.endLine + lineDelta,
        modelVersionId: snapshot.modelVersionId,
      }
    }),
  }
}
