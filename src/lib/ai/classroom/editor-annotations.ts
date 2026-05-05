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
  getLineText: (line: number) => string
}

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

export function refreshChatAnnotationsAfterEdit(state: EditorAnnotationState, snapshot: EditorEditSnapshot): EditorAnnotationState {
  return {
    annotations: state.annotations.map((annotation) => {
      if (annotation.namespace !== 'chat' || annotation.stale)
        return annotation
      if (annotation.modelVersionId === snapshot.modelVersionId)
        return annotation
      const targetLine = snapshot.getLineText(annotation.startLine)
      if (targetLine.includes(annotation.targetSnippet))
        return annotation
      return { ...annotation, stale: true }
    }),
  }
}
