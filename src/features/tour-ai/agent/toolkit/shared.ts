import type { AIClassroomBridgeValue, AIClassroomStateBridge } from '@/lib/ai/classroom/bridge'
import type * as monaco from '@codingame/monaco-vscode-editor-api'

export function requireClassroom(bridge: AIClassroomBridgeValue): AIClassroomStateBridge {
  if (!bridge.classroom)
    throw new Error('Classroom state is not ready yet')
  return bridge.classroom
}

export function getModel(bridge: AIClassroomBridgeValue) {
  const editor = bridge.editor.getEditor()
  const model = editor?.getModel()
  if (!model || !editor)
    throw new Error('Editor is not ready yet')
  return { editor, model }
}

export function withLineNumbers(text: string): string {
  return text
    .split('\n')
    .map((line, i) => `${String(i + 1).padStart(4, ' ')}  ${line}`)
    .join('\n')
}

export function targetSnippet(model: monaco.editor.ITextModel, startLine: number, startColumn?: number, endColumn?: number): string {
  const line = model.getLineContent(startLine)
  if (startColumn && endColumn && endColumn > startColumn)
    return line.slice(startColumn - 1, endColumn - 1).trim()
  return line.trim()
}
