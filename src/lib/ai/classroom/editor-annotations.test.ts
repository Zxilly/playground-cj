import { describe, expect, it } from 'vitest'
import type { EditorAnnotation } from './editor-annotations'
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
      lineCount: 10,
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

  it('keeps chat annotations fresh when the edited line still contains the target snippet', () => {
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
      lineCount: 10,
      getLineText: () => '    println(i)',
    })

    expect(refreshed.annotations).toEqual([
      expect.objectContaining({
        namespace: 'chat',
        stale: false,
        modelVersionId: 5,
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

describe('refreshChatAnnotationsAfterEdit window search', () => {
  const baseAnnotation = (overrides: Partial<EditorAnnotation> = {}): EditorAnnotation => ({
    namespace: 'chat',
    kind: 'highlight',
    startLine: 5,
    endLine: 5,
    targetSnippet: 'println(total)',
    modelVersionId: 1,
    stale: false,
    ...overrides,
  })

  it('finds snippet that moved up by 2 lines and updates startLine/endLine', () => {
    const state = createEditorAnnotationState([baseAnnotation({ startLine: 5, endLine: 5 })])
    const refreshed = refreshChatAnnotationsAfterEdit(state, {
      modelVersionId: 2,
      lineCount: 10,
      getLineText: line => line === 3 ? 'println(total)' : '',
    })
    expect(refreshed.annotations[0]).toMatchObject({
      stale: false,
      startLine: 3,
      endLine: 3,
      modelVersionId: 2,
    })
  })

  it('finds snippet that moved down by 3 lines and updates lines', () => {
    const state = createEditorAnnotationState([baseAnnotation({ startLine: 5, endLine: 6 })])
    const refreshed = refreshChatAnnotationsAfterEdit(state, {
      modelVersionId: 2,
      lineCount: 10,
      getLineText: line => line === 8 ? 'println(total)' : '',
    })
    expect(refreshed.annotations[0]).toMatchObject({
      stale: false,
      startLine: 8,
      endLine: 9,
      modelVersionId: 2,
    })
  })

  it('marks annotation stale when snippet moves outside ±5 line window', () => {
    const state = createEditorAnnotationState([baseAnnotation({ startLine: 5 })])
    const refreshed = refreshChatAnnotationsAfterEdit(state, {
      modelVersionId: 2,
      lineCount: 30,
      getLineText: line => line === 15 ? 'println(total)' : '',
    })
    expect(refreshed.annotations[0].stale).toBe(true)
  })

  it('marks annotation stale when snippet is gone entirely', () => {
    const state = createEditorAnnotationState([baseAnnotation({ startLine: 5 })])
    const refreshed = refreshChatAnnotationsAfterEdit(state, {
      modelVersionId: 2,
      lineCount: 10,
      getLineText: () => 'unrelated',
    })
    expect(refreshed.annotations[0].stale).toBe(true)
  })

  it('returns annotation unchanged when modelVersionId matches', () => {
    const state = createEditorAnnotationState([baseAnnotation({ modelVersionId: 7 })])
    const refreshed = refreshChatAnnotationsAfterEdit(state, {
      modelVersionId: 7,
      lineCount: 10,
      getLineText: () => '',
    })
    expect(refreshed.annotations[0]).toEqual(state.annotations[0])
  })

  it('does not touch already-stale annotations', () => {
    const state = createEditorAnnotationState([baseAnnotation({ stale: true })])
    const refreshed = refreshChatAnnotationsAfterEdit(state, {
      modelVersionId: 2,
      lineCount: 10,
      getLineText: () => 'println(total)',
    })
    expect(refreshed.annotations[0].stale).toBe(true)
  })

  it('does not touch compiler-namespace annotations', () => {
    const compilerAnn: EditorAnnotation = baseAnnotation({ namespace: 'compiler' })
    const state = createEditorAnnotationState([compilerAnn])
    const refreshed = refreshChatAnnotationsAfterEdit(state, {
      modelVersionId: 99,
      lineCount: 10,
      getLineText: () => '',
    })
    expect(refreshed.annotations[0]).toEqual(compilerAnn)
  })
})
