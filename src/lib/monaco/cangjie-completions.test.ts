import { describe, expect, it, vi } from 'vitest'
import { createCangjieCompletionProvider, extractCangjieIdentifiers } from './cangjie-completions'

vi.mock('@codingame/monaco-vscode-editor-api', () => ({
  languages: {
    CompletionItemKind: {
      Variable: 4,
      Function: 1,
      Class: 6,
      Keyword: 17,
    },
    registerCompletionItemProvider: vi.fn(),
  },
}))

describe('cangjie completion fallback', () => {
  it('extracts declared symbols without duplicates', () => {
    expect(extractCangjieIdentifiers(`
      let greeting = "你好"
      var count = 1
      func greet() {}
      let greeting = "再见"
    `)).toEqual(['greeting', 'count', 'greet'])
  })

  it('offers local symbols, language keywords, types and built-ins', async () => {
    const provider = createCangjieCompletionProvider()
    const result = await provider.provideCompletionItems!(
      {
        getValue: () => 'let greeting = "你好"\ngre',
        getWordUntilPosition: () => ({ word: 'gre', startColumn: 1, endColumn: 4 }),
      } as never,
      { lineNumber: 2, column: 4 } as never,
      {} as never,
      { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) } as never,
    )
    const labels = result?.suggestions.map(item =>
      typeof item.label === 'string' ? item.label : item.label.label)
    expect(labels).toEqual(expect.arrayContaining(['greeting', 'let', 'String', 'println']))
    expect(result?.suggestions.find(item => item.label === 'greeting')?.range).toMatchObject({
      startLineNumber: 2,
      startColumn: 1,
      endLineNumber: 2,
      endColumn: 4,
    })
  })
})
