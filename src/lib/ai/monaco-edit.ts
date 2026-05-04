import * as monaco from '@codingame/monaco-vscode-editor-api'
import { createTwoFilesPatch, diffLines } from 'diff'
import { replace } from './edit-strategies'

export interface MonacoEditResult {
  diff: string
  additions: number
  deletions: number
  oldLineCount: number
  newLineCount: number
}

let queue: Promise<unknown> = Promise.resolve()

function enqueue<T>(fn: () => Promise<T> | T): Promise<T> {
  const next = queue.then(() => fn())
  queue = next.catch(() => undefined)
  return next
}

function setModelText(model: monaco.editor.ITextModel, text: string) {
  model.pushEditOperations(
    [],
    [{ range: model.getFullModelRange(), text, forceMoveMarkers: true }],
    () => null,
  )
}

function summarize(oldContent: string, newContent: string, label: string): MonacoEditResult {
  const patch = createTwoFilesPatch(label, label, oldContent, newContent)
  let additions = 0
  let deletions = 0
  for (const change of diffLines(oldContent, newContent)) {
    if (change.added)
      additions += change.count ?? 0
    if (change.removed)
      deletions += change.count ?? 0
  }
  return {
    diff: patch,
    additions,
    deletions,
    oldLineCount: oldContent === '' ? 0 : oldContent.split('\n').length,
    newLineCount: newContent === '' ? 0 : newContent.split('\n').length,
  }
}

export function applyEdit(
  model: monaco.editor.ITextModel,
  oldString: string,
  newString: string,
  replaceAll = false,
): Promise<MonacoEditResult> {
  return enqueue(() => {
    if (oldString === '') {
      throw new Error('oldString must not be empty; use replaceAll/setValue for full-file replacement.')
    }
    const before = model.getValue()
    const after = replace(before, oldString, newString, replaceAll)
    setModelText(model, after)
    return summarize(before, after, model.uri.path || 'editor')
  })
}

export function applyFullReplace(
  model: monaco.editor.ITextModel,
  newCode: string,
): Promise<MonacoEditResult> {
  return enqueue(() => {
    const before = model.getValue()
    if (before === newCode)
      return summarize(before, newCode, model.uri.path || 'editor')
    setModelText(model, newCode)
    return summarize(before, newCode, model.uri.path || 'editor')
  })
}

export function applyInsertAtLine(
  model: monaco.editor.ITextModel,
  line: number,
  text: string,
): Promise<MonacoEditResult> {
  return enqueue(() => {
    const lineCount = model.getLineCount()
    const safeLine = Math.max(1, Math.min(line, lineCount + 1))
    const before = model.getValue()
    const insertText = text.endsWith('\n') ? text : `${text}\n`
    const range = safeLine > lineCount
      ? new monaco.Range(lineCount, model.getLineMaxColumn(lineCount), lineCount, model.getLineMaxColumn(lineCount))
      : new monaco.Range(safeLine, 1, safeLine, 1)
    const finalText = safeLine > lineCount ? `\n${text.replace(/\n$/, '')}` : insertText
    model.pushEditOperations(
      [],
      [{ range, text: finalText, forceMoveMarkers: true }],
      () => null,
    )
    const after = model.getValue()
    return summarize(before, after, model.uri.path || 'editor')
  })
}
