import type * as monaco from '@codingame/monaco-vscode-editor-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearCompilerMarkers, compilerMarkers, setCompilerMarkers } from './compiler-markers'

const setModelMarkers = vi.hoisted(() => vi.fn())

vi.mock('@codingame/monaco-vscode-editor-api', () => ({
  MarkerSeverity: { Warning: 4, Error: 8 },
  editor: {
    setModelMarkers,
  },
}))

describe('compiler marker adapter', () => {
  beforeEach(() => {
    setModelMarkers.mockReset()
  })

  it('clamps locations to the model and excludes other source files', () => {
    const model = {
      uri: { path: '/playground/src/main.cj' },
      getLineCount: () => 5,
      getLineMaxColumn: () => 10,
    } as unknown as monaco.editor.ITextModel
    expect(compilerMarkers('main.cj:99:88: warning: unused\nstdlib.cj:2:3: error: missing', model)).toEqual([{
      severity: 4,
      message: 'main.cj:99:88: warning: unused',
      startLineNumber: 5,
      startColumn: 10,
      endLineNumber: 5,
      endColumn: 10,
    }])
  })

  it('expands single-column diagnostics to the full word span when available', () => {
    const model = {
      uri: { path: '/playground/src/main.cj' },
      getLineCount: () => 10,
      getLineMaxColumn: () => 40,
      getWordAtPosition: vi.fn(({ column }: { column: number }) =>
        column === 5 ? { word: 'unknownVar', startColumn: 5, endColumn: 15 } : null,
      ),
    } as unknown as monaco.editor.ITextModel

    expect(compilerMarkers('main.cj:2:5: error: undeclared identifier\nmain.cj:3:1: error: unexpected token', model)).toEqual([
      {
        severity: 8,
        message: 'main.cj:2:5: error: undeclared identifier',
        startLineNumber: 2,
        startColumn: 5,
        endLineNumber: 2,
        endColumn: 15,
      },
      {
        severity: 8,
        message: 'main.cj:3:1: error: unexpected token',
        startLineNumber: 3,
        startColumn: 1,
        endLineNumber: 3,
        endColumn: 2,
      },
    ])
  })

  it('auto-clears stale run diagnostics when the user edits the model', () => {
    let onChange: (() => void) | undefined
    const disposeChange = vi.fn()
    const disposeWillDispose = vi.fn()
    const model = {
      uri: { path: '/playground/src/main.cj' },
      getLineCount: () => 10,
      getLineMaxColumn: () => 40,
      isDisposed: () => false,
      getWordAtPosition: () => ({ word: 'badIdent', startColumn: 3, endColumn: 11 }),
      onDidChangeContent: vi.fn((listener: () => void) => {
        onChange = listener
        return { dispose: disposeChange }
      }),
      onWillDispose: vi.fn(() => ({ dispose: disposeWillDispose })),
    } as unknown as monaco.editor.ITextModel

    setCompilerMarkers(model, 'tour-run', 'main.cj:1:3: error: bad identifier')
    expect(setModelMarkers).toHaveBeenCalledTimes(1)
    expect(setModelMarkers.mock.calls[0]?.[2]).toHaveLength(1)

    onChange?.()
    expect(setModelMarkers).toHaveBeenCalledTimes(2)
    expect(setModelMarkers).toHaveBeenLastCalledWith(model, 'tour-run', [])
    expect(disposeChange).toHaveBeenCalledOnce()
    expect(disposeWillDispose).toHaveBeenCalledOnce()

    clearCompilerMarkers(model, 'tour-run')
    expect(setModelMarkers).toHaveBeenCalledTimes(3)
  })
})
