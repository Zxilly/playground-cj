import { describe, expect, it } from 'vitest'
import {
  clearChatAnnotations,
  createEditorAnnotationState,
  refreshChatAnnotationsAfterEdit,
  replaceChatAnnotations,
} from './editor-annotations'

describe('chat editor annotations', () => {
  it('keeps chat annotations in a separate namespace and replaces previous chat marks', () => {
    let state = createEditorAnnotationState([
      {
        namespace: 'compiler',
        kind: 'underline',
        startLine: 1,
        endLine: 1,
        modelVersionId: 3,
        targetSnippet: 'syntax error',
        stale: false,
      },
    ])

    state = replaceChatAnnotations(state, [
      {
        kind: 'highlight',
        startLine: 2,
        endLine: 3,
        label: 'loop body',
        modelVersionId: 4,
        targetSnippet: 'println(i)',
      },
    ])
    state = replaceChatAnnotations(state, [
      {
        kind: 'underline',
        startLine: 5,
        endLine: 5,
        modelVersionId: 5,
        targetSnippet: 'println(total)',
      },
    ])

    expect(state.annotations).toEqual([
      expect.objectContaining({ namespace: 'compiler', startLine: 1 }),
      expect.objectContaining({
        namespace: 'chat',
        kind: 'underline',
        startLine: 5,
        modelVersionId: 5,
        stale: false,
      }),
    ])
    expect(state.annotations.some(annotation => annotation.startLine === 2)).toBe(false)
  })

  it('marks a chat annotation stale when the target snippet no longer matches after edit', () => {
    const state = replaceChatAnnotations(createEditorAnnotationState(), [
      {
        kind: 'highlight',
        startLine: 2,
        endLine: 2,
        modelVersionId: 4,
        targetSnippet: 'println(i)',
      },
    ])

    const refreshed = refreshChatAnnotationsAfterEdit(state, {
      modelVersionId: 5,
      getLineText: () => 'println(total)',
    })

    expect(refreshed.annotations).toEqual([
      expect.objectContaining({
        namespace: 'chat',
        stale: true,
        modelVersionId: 4,
      }),
    ])
  })

  it('clears only chat annotations', () => {
    const state = replaceChatAnnotations(createEditorAnnotationState([
      {
        namespace: 'compiler',
        kind: 'underline',
        startLine: 1,
        endLine: 1,
        modelVersionId: 2,
        targetSnippet: 'error',
        stale: false,
      },
    ]), [
      {
        kind: 'highlight',
        startLine: 3,
        endLine: 3,
        modelVersionId: 4,
        targetSnippet: 'let x',
      },
    ])

    expect(clearChatAnnotations(state).annotations).toEqual([
      expect.objectContaining({ namespace: 'compiler' }),
    ])
  })
})
