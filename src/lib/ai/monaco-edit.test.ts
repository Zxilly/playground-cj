import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as monaco from '@codingame/monaco-vscode-editor-api'

vi.mock('@codingame/monaco-vscode-editor-api', () => ({
  Range: class {
    constructor(
      public startLineNumber: number,
      public startColumn: number,
      public endLineNumber: number,
      public endColumn: number,
    ) {}
  },
}))

describe('monaco edit helpers', () => {
  beforeEach(async () => {
    const { applyFullReplace } = await import('./monaco-edit')
    await applyFullReplace(createModel(''), '')
  })

  it('rejects empty search text without blocking later queued edits', async () => {
    const { applyEdit, applyFullReplace } = await import('./monaco-edit')
    const model = createModel('let x = 1')

    await expect(applyEdit(model, '', 'let x = 2')).rejects.toThrow('oldString must not be empty')
    const result = await applyFullReplace(model, 'let x = 2')

    expect(model.getValue()).toBe('let x = 2')
    expect(result.additions).toBe(1)
    expect(result.deletions).toBe(1)
  })

  it('applies a targeted replacement and reports line counts', async () => {
    const { applyEdit } = await import('./monaco-edit')
    const model = createModel('first\nsecond\nthird')

    const result = await applyEdit(model, 'second', 'third', false)

    expect(model.getValue()).toBe('first\nthird\nthird')
    expect(result.oldLineCount).toBe(3)
    expect(result.newLineCount).toBe(3)
    expect(result.diff).toContain('editor.cj')
  })

  it('skips edit operations when full replacement content is unchanged', async () => {
    const { applyFullReplace } = await import('./monaco-edit')
    const model = createModel('same')

    const result = await applyFullReplace(model, 'same')

    expect(model.pushEditOperations).not.toHaveBeenCalled()
    expect(result.additions).toBe(0)
    expect(result.deletions).toBe(0)
  })

  it('clamps insert lines before the first line and after the end', async () => {
    const { applyInsertAtLine } = await import('./monaco-edit')
    const model = createModel('one\ntwo')

    await applyInsertAtLine(model, -10, 'zero')
    await applyInsertAtLine(model, 99, 'three\n')

    expect(model.getValue()).toBe('zero\none\ntwo\nthree')
  })
})

type TestModel = monaco.editor.ITextModel & {
  pushEditOperations: ReturnType<typeof vi.fn>
}

function createModel(initial: string): TestModel {
  let value = initial
  return {
    uri: { path: '/tmp/editor.cj' },
    getValue: () => value,
    getLineCount: () => value === '' ? 1 : value.split('\n').length,
    getLineContent: (line: number) => value.split('\n')[line - 1] ?? '',
    getLineMaxColumn: (line: number) => (value.split('\n')[line - 1] ?? '').length + 1,
    getFullModelRange: () => ({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: value === '' ? 1 : value.split('\n').length,
      endColumn: (value.split('\n').at(-1) ?? '').length + 1,
    }),
    pushEditOperations: vi.fn((_, edits: Array<{ range: RangeLike, text: string }>) => {
      for (const edit of edits)
        value = applyRangeEdit(value, edit.range, edit.text)
      return null
    }),
  } as unknown as TestModel
}

interface RangeLike {
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
}

function applyRangeEdit(value: string, range: RangeLike, text: string): string {
  const start = offsetAt(value, range.startLineNumber, range.startColumn)
  const end = offsetAt(value, range.endLineNumber, range.endColumn)
  return `${value.slice(0, start)}${text}${value.slice(end)}`
}

function offsetAt(value: string, line: number, column: number): number {
  const lines = value.split('\n')
  let offset = 0
  for (let i = 0; i < line - 1; i++)
    offset += (lines[i]?.length ?? 0) + 1
  return offset + column - 1
}
