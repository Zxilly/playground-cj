import { describe, expect, it, vi } from 'vitest'
import { createLspDocumentMirror } from './lsp-document-mirror'

function message(method: string, params: object): string {
  return JSON.stringify({ jsonrpc: '2.0', method, params })
}

describe('lspDocumentMirror', () => {
  it('creates the physical document before the server handles didOpen', () => {
    const mkdir = vi.fn()
    const writeFile = vi.fn()
    const mirror = createLspDocumentMirror({ mkdir, writeFile })

    mirror.handle(message('textDocument/didOpen', {
      textDocument: {
        uri: 'file:///playground/src/exercise-teach-playground.cj',
        text: 'main() {}',
      },
    }))

    expect(mkdir).toHaveBeenCalledWith('/playground/src')
    expect(writeFile).toHaveBeenCalledWith(
      '/playground/src/exercise-teach-playground.cj',
      new TextEncoder().encode('main() {}'),
    )
  })

  it('applies incremental didChange edits to the physical document', () => {
    const writeFile = vi.fn()
    const mirror = createLspDocumentMirror({ mkdir: vi.fn(), writeFile })
    const uri = 'file:///playground/src/main.cj'
    mirror.handle(message('textDocument/didOpen', {
      textDocument: { uri, text: 'let value = 1\n' },
    }))

    mirror.handle(message('textDocument/didChange', {
      textDocument: { uri },
      contentChanges: [{
        range: {
          start: { line: 0, character: 12 },
          end: { line: 0, character: 13 },
        },
        text: '2',
      }],
    }))

    expect(new TextDecoder().decode(writeFile.mock.lastCall?.[1])).toBe('let value = 2\n')
  })

  it('ignores documents outside the playground project', () => {
    const writeFile = vi.fn()
    const mirror = createLspDocumentMirror({ mkdir: vi.fn(), writeFile })

    mirror.handle(message('textDocument/didOpen', {
      textDocument: { uri: 'file:///outside/main.cj', text: 'main() {}' },
    }))

    expect(writeFile).not.toHaveBeenCalled()
  })
})
