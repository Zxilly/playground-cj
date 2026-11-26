import * as monaco from '@codingame/monaco-vscode-editor-api'
import { parseCompilerDiagnostics } from '@/lib/compiler-diagnostics'

const autoClearSubscriptions = new WeakMap<
  monaco.editor.ITextModel,
  Map<string, { dispose: () => void }>
>()

function disposeAutoClear(model: monaco.editor.ITextModel, owner: string): void {
  const byOwner = autoClearSubscriptions.get(model)
  const existing = byOwner?.get(owner)
  if (!existing)
    return
  byOwner?.delete(owner)
  existing.dispose()
}

/** Keep model bounds and marker presentation out of the compiler text parser. */
export function compilerMarkers(output: string, model: monaco.editor.ITextModel): monaco.editor.IMarkerData[] {
  const fileName = model.uri.path.split('/').at(-1)
  return parseCompilerDiagnostics(output)
    .filter(diagnostic => diagnostic.file.split(/[\\/]/).at(-1) === fileName)
    .map((diagnostic) => {
      const line = Math.min(Math.max(diagnostic.line, 1), model.getLineCount())
      const maxColumn = model.getLineMaxColumn(line)
      const column = Math.min(Math.max(diagnostic.column, 1), maxColumn)
      const word = typeof model.getWordAtPosition === 'function'
        ? model.getWordAtPosition({ lineNumber: line, column })
        : null
      const startColumn = word ? Math.min(Math.max(word.startColumn, 1), maxColumn) : column
      const endColumn = word && word.endColumn > startColumn
        ? Math.min(word.endColumn, maxColumn)
        : Math.min(column + 1, maxColumn)
      return {
        severity: diagnostic.severity === 'warning' ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Error,
        message: diagnostic.message,
        startLineNumber: line,
        startColumn,
        endLineNumber: line,
        endColumn,
      }
    })
}

/**
 * Applies compiler run diagnostics to `model` and automatically clears stale
 * markers for `owner` as soon as the user edits the model content.
 */
export function setCompilerMarkers(
  model: monaco.editor.ITextModel,
  owner: string,
  output: string,
): monaco.editor.IMarkerData[] {
  disposeAutoClear(model, owner)
  const markers = compilerMarkers(output, model)
  monaco.editor.setModelMarkers(model, owner, markers)

  if (markers.length > 0 && typeof model.onDidChangeContent === 'function') {
    let byOwner = autoClearSubscriptions.get(model)
    if (!byOwner) {
      byOwner = new Map()
      autoClearSubscriptions.set(model, byOwner)
    }
    const contentSub = model.onDidChangeContent(() => {
      disposeAutoClear(model, owner)
      if (typeof model.isDisposed !== 'function' || !model.isDisposed())
        monaco.editor.setModelMarkers(model, owner, [])
    })
    const disposeSub = typeof model.onWillDispose === 'function'
      ? model.onWillDispose(() => disposeAutoClear(model, owner))
      : undefined
    byOwner.set(owner, {
      dispose: () => {
        contentSub.dispose()
        disposeSub?.dispose()
      },
    })
  }

  return markers
}

export function clearCompilerMarkers(model: monaco.editor.ITextModel, owner: string): void {
  disposeAutoClear(model, owner)
  if (typeof model.isDisposed !== 'function' || !model.isDisposed())
    monaco.editor.setModelMarkers(model, owner, [])
}
