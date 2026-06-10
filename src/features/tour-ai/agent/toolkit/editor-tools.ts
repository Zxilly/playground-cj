import type { Toolkit } from '@assistant-ui/react'
import { z } from 'zod'
import * as monaco from '@codingame/monaco-vscode-editor-api'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import { useCodeSuggestionStore } from '@/features/tour-ai/state/code-suggestion-store'
import { resolveLearnerCodeSource } from '@/features/tour-ai/exercise-workspace/learner-code-source'
import { fail, ok } from './results'
import { getModel, requireClassroom, targetSnippet, withLineNumbers } from './shared'

const CHAT_MARKER_NAMESPACE = 'chat'
const MAX_MARKER_LABEL_LENGTH = 80

function validateLineRange(model: monaco.editor.ITextModel, startLine: number, endLine: number): string | null {
  const lineCount = model.getLineCount()
  if (endLine < startLine)
    return `Invalid editor line range: endLine ${endLine} is before startLine ${startLine}.`
  if (startLine > lineCount || endLine > lineCount)
    return `Editor line range ${startLine}-${endLine} is outside the current editor bounds (1-${lineCount}).`
  return null
}

function validateEditorRange(
  model: monaco.editor.ITextModel,
  startLine: number,
  startColumn: number,
  endLine: number,
  endColumn: number,
): string | null {
  const lineError = validateLineRange(model, startLine, endLine)
  if (lineError)
    return lineError
  if (endLine === startLine && endColumn <= startColumn)
    return `Invalid editor range: endColumn ${endColumn} must be after startColumn ${startColumn}.`

  const maxStartColumn = model.getLineMaxColumn(startLine)
  const maxEndColumn = model.getLineMaxColumn(endLine)
  if (startColumn > maxStartColumn)
    return `Start column ${startColumn} is outside line ${startLine} (1-${maxStartColumn}).`
  if (endColumn > maxEndColumn)
    return `End column ${endColumn} is outside line ${endLine} (1-${maxEndColumn}).`
  return null
}

function chatMarkerLabel(bridge: AIClassroomBridgeValue, label: string | undefined, fallback: 'highlight' | 'underline'): string {
  const text = label?.trim()
  if (text)
    return text.length > MAX_MARKER_LABEL_LENGTH ? `${text.slice(0, MAX_MARKER_LABEL_LENGTH - 1)}…` : text
  if (bridge.uiLang === 'en')
    return fallback === 'highlight' ? 'AI highlight' : 'AI annotation'
  return fallback === 'highlight' ? 'AI 高亮' : 'AI 标注'
}

export function createEditorTools(bridge: AIClassroomBridgeValue): Toolkit {
  return {
    read_editor_code: {
      description: 'Read the learner\'s current exercise code. When the live editor is unavailable, falls back to the persisted draft and then to the exercise starter code. Use withLineNumbers when discussing line-specific code.',
      parameters: z.object({ withLineNumbers: z.boolean().optional() }),
      execute: async ({ withLineNumbers: numbered }) => {
        const formatCode = (code: string) => numbered ? withLineNumbers(code) : code

        const source = resolveLearnerCodeSource(bridge)
        if (source) {
          return ok({
            ...source,
            code: formatCode(source.code),
          })
        }

        return fail('No code to read — no active exercise and no live editor on the page.')
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
          const resolvedEndLine = endLine ?? startLine
          const rangeError = validateLineRange(model, startLine, resolvedEndLine)
          if (rangeError)
            return fail(rangeError)
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
            message: chatMarkerLabel(bridge, label, 'highlight'),
            startLineNumber: startLine,
            startColumn: 1,
            endLineNumber: resolvedEndLine,
            endColumn: model.getLineMaxColumn(resolvedEndLine),
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
          const rangeError = validateEditorRange(model, startLine, startColumn, endLine, endColumn)
          if (rangeError)
            return fail(rangeError)
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
            message: chatMarkerLabel(bridge, label, 'underline'),
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

    suggest_code_change: {
      description: 'Stage a proposed code replacement for the active exercise without applying it. The learner sees a diff banner and decides whether to apply. Use this for "here is what I would write" — never silently rewrite the learner\'s code. Pass the full replacement source in `code`, the active exercise id in `exerciseId` (from read_current_exercise / read_classroom_state), and a one-paragraph rationale in `explanation`.',
      parameters: z.object({
        exerciseId: z.string(),
        code: z.string(),
        explanation: z.string().max(800),
      }),
      execute: async ({ exerciseId, code, explanation }) => {
        try {
          // Verify the suggestion targets the currently active exercise; refuse
          // stale or speculative targets so old suggestions don't leak into
          // the next exercise.
          const session = requireClassroom(bridge).getSession()
          const active = session.currentExercise
          if (!active || active.status !== 'active')
            return fail('No active exercise; suggest_code_change can only run while an exercise is active.')
          if (active.id !== exerciseId)
            return fail(`Exercise id mismatch — active exercise is ${active.id}, but you targeted ${exerciseId}. Re-fetch via read_current_exercise before suggesting.`)
          useCodeSuggestionStore.getState().setSuggestion({
            exerciseId,
            code,
            explanation,
            createdAt: Date.now(),
          })
          return ok({ staged: true })
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },
  }
}
