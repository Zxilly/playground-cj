import type { Toolkit } from '@assistant-ui/react'
import { z } from 'zod'
import * as monaco from '@codingame/monaco-vscode-editor-api'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import { fail, ok } from './results'
import { getModel, requireClassroom, targetSnippet, withLineNumbers } from './shared'

const CHAT_MARKER_NAMESPACE = 'chat'

export function createEditorTools(bridge: AIClassroomBridgeValue): Toolkit {
  return {
    read_editor_code: {
      description: 'Read the current Monaco editor code. Use withLineNumbers when discussing line-specific code.',
      parameters: z.object({ withLineNumbers: z.boolean().optional() }),
      execute: async ({ withLineNumbers: numbered }) => {
        try {
          const { model } = getModel(bridge)
          const code = model.getValue()
          return ok({
            code: numbered ? withLineNumbers(code) : code,
            lineCount: model.getLineCount(),
            language: model.getLanguageId(),
          })
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    highlight_editor_lines: {
      description: 'Highlight one or more editor lines for chat guidance. Replaces previous chat annotations.',
      parameters: z.object({
        startLine: z.number().int().min(1),
        endLine: z.number().int().min(1).optional(),
        label: z.string().optional(),
      }),
      execute: async ({ startLine, endLine, label }) => {
        try {
          const { model } = getModel(bridge)
          requireClassroom(bridge).replaceChatAnnotations([{
            kind: 'highlight',
            startLine,
            endLine,
            label,
            modelVersionId: model.getVersionId(),
            targetSnippet: targetSnippet(model, startLine),
          }])
          monaco.editor.setModelMarkers(model, CHAT_MARKER_NAMESPACE, [{
            severity: monaco.MarkerSeverity.Hint,
            message: label ?? '聊天高亮',
            startLineNumber: startLine,
            startColumn: 1,
            endLineNumber: endLine ?? startLine,
            endColumn: model.getLineMaxColumn(endLine ?? startLine),
          }])
          return ok()
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    underline_editor_range: {
      description: 'Underline a precise editor range for chat guidance. Replaces previous chat annotations.',
      parameters: z.object({
        startLine: z.number().int().min(1),
        startColumn: z.number().int().min(1),
        endLine: z.number().int().min(1),
        endColumn: z.number().int().min(1),
        label: z.string().optional(),
      }),
      execute: async ({ startLine, startColumn, endLine, endColumn, label }) => {
        try {
          const { model } = getModel(bridge)
          requireClassroom(bridge).replaceChatAnnotations([{
            kind: 'underline',
            startLine,
            endLine,
            label,
            modelVersionId: model.getVersionId(),
            targetSnippet: targetSnippet(model, startLine, startColumn, endColumn),
          }])
          monaco.editor.setModelMarkers(model, CHAT_MARKER_NAMESPACE, [{
            severity: monaco.MarkerSeverity.Info,
            message: label ?? '聊天标注',
            startLineNumber: startLine,
            startColumn,
            endLineNumber: endLine,
            endColumn,
          }])
          return ok()
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    reveal_editor_line: {
      description: 'Scroll the editor to a line.',
      parameters: z.object({ line: z.number().int().min(1) }),
      execute: async ({ line }) => {
        try {
          getModel(bridge).editor.revealLineInCenter(line)
          return ok()
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    clear_editor_annotations: {
      description: 'Clear chat annotations without touching compiler markers.',
      parameters: z.object({}),
      execute: async () => {
        try {
          const { model } = getModel(bridge)
          requireClassroom(bridge).clearChatAnnotations()
          monaco.editor.setModelMarkers(model, CHAT_MARKER_NAMESPACE, [])
          return ok()
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },
  }
}
