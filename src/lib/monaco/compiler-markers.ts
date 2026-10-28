import * as monaco from '@codingame/monaco-vscode-editor-api'
import { parseCompilerDiagnostics } from '@/lib/compiler-diagnostics'

/** Keep model bounds and marker presentation out of the compiler text parser. */
export function compilerMarkers(output: string, model: monaco.editor.ITextModel): monaco.editor.IMarkerData[] {
  const fileName = model.uri.path.split('/').at(-1)
  return parseCompilerDiagnostics(output)
    .filter(diagnostic => diagnostic.file.split(/[\\/]/).at(-1) === fileName)
    .map((diagnostic) => {
      const line = Math.min(Math.max(diagnostic.line, 1), model.getLineCount())
      const maxColumn = model.getLineMaxColumn(line)
      const column = Math.min(Math.max(diagnostic.column, 1), maxColumn)
      return {
        severity: diagnostic.severity === 'warning' ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Error,
        message: diagnostic.message,
        startLineNumber: line,
        startColumn: column,
        endLineNumber: line,
        endColumn: Math.min(column + 1, maxColumn),
      }
    })
}
