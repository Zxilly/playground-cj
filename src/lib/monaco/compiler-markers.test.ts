import type * as monaco from '@codingame/monaco-vscode-editor-api'
import { describe, expect, it, vi } from 'vitest'
import { compilerMarkers } from './compiler-markers'

vi.mock('@codingame/monaco-vscode-editor-api', () => ({ MarkerSeverity: { Warning: 4, Error: 8 } }))

describe('compiler marker adapter', () => {
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
})
