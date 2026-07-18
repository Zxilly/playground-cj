interface WritableWasmFs {
  mkdir: (path: string) => void
  writeFile: (path: string, data: Uint8Array) => void
}

interface Position {
  line: number
  character: number
}

interface ContentChange {
  range?: {
    start: Position
    end: Position
  }
  text: string
}

export const PLAYGROUND_PROJECT_MANIFEST = `[package]
cjc-version = "1.1.0-beta.25"
name = "playground"
description = "Browser Playground"
version = "1.0.0"
target-dir = ""
src-dir = "src"
output-type = "executable"
compile-option = ""
override-compile-option = ""
link-option = ""
package-configuration = {}
`

export const PLAYGROUND_INACTIVE_DOCUMENT = 'package playground\n'

interface MirroredDocument {
  text: string
  version: number
}

function mkdirP(fs: WritableWasmFs, path: string): void {
  const parts = path.split('/').filter(Boolean)
  let current = ''
  for (const part of parts) {
    current += `/${part}`
    try {
      fs.mkdir(current)
    }
    catch {}
  }
}

function filePathInRoot(uri: string, root: string): string | null {
  try {
    const url = new URL(uri)
    if (url.protocol !== 'file:')
      return null
    const path = decodeURIComponent(url.pathname)
    return path.startsWith(`${root}/`) ? path : null
  }
  catch {
    return null
  }
}

function offsetAt(text: string, position: Position): number {
  let lineStart = 0
  for (let line = 0; line < position.line; line += 1) {
    const newline = text.indexOf('\n', lineStart)
    if (newline < 0)
      return text.length
    lineStart = newline + 1
  }
  const lineEnd = text.indexOf('\n', lineStart)
  return Math.min(lineStart + position.character, lineEnd < 0 ? text.length : lineEnd)
}

function applyChanges(text: string, changes: readonly ContentChange[]): string {
  let next = text
  for (const change of changes) {
    if (!change.range) {
      next = change.text
      continue
    }
    const start = offsetAt(next, change.range.start)
    const end = offsetAt(next, change.range.end)
    next = `${next.slice(0, start)}${change.text}${next.slice(end)}`
  }
  return next
}

/**
 * Mirror open LSP documents into the Emscripten filesystem. The Cangjie server
 * resolves project membership from real paths even though document text also
 * arrives over LSP, so a protocol-only buffer otherwise gets no semantic model.
 */
export function createLspDocumentMirror(fs: WritableWasmFs, root = '/playground') {
  const documents = new Map<string, MirroredDocument>()
  const encoder = new TextEncoder()

  const write = (path: string, text: string) => {
    mkdirP(fs, path.slice(0, path.lastIndexOf('/')))
    fs.writeFile(path, encoder.encode(text))
  }

  return {
    handle(message: string): string | undefined {
      let parsed: {
        method?: string
        params?: {
          textDocument?: { uri?: string, text?: string, version?: number }
          contentChanges?: ContentChange[]
        }
      }
      try {
        parsed = JSON.parse(message)
      }
      catch {
        return
      }

      const uri = parsed.params?.textDocument?.uri
      if (!uri)
        return
      const path = filePathInRoot(uri, root)
      if (!path)
        return

      if (parsed.method === 'textDocument/didOpen') {
        const text = parsed.params?.textDocument?.text ?? ''
        const version = parsed.params?.textDocument?.version ?? 1
        documents.set(uri, { text, version })
        write(path, text)
      }
      else if (parsed.method === 'textDocument/didChange') {
        const current = documents.get(uri)
        const changes = parsed.params?.contentChanges
        if (current === undefined || !changes)
          return
        const text = applyChanges(current.text, changes)
        const version = parsed.params?.textDocument?.version ?? current.version + 1
        documents.set(uri, { text, version })
        write(path, text)
      }
      else if (parsed.method === 'textDocument/didClose') {
        const current = documents.get(uri)
        if (!current)
          return
        const version = current.version + 1
        write(path, PLAYGROUND_INACTIVE_DOCUMENT)
        documents.delete(uri)
        return JSON.stringify({
          jsonrpc: '2.0',
          method: 'textDocument/didChange',
          params: {
            textDocument: { uri, version },
            contentChanges: [{ text: PLAYGROUND_INACTIVE_DOCUMENT }],
          },
        })
      }
    },
  }
}
