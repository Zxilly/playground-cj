import type { Toolkit } from '@assistant-ui/react'
import { z } from 'zod'
import * as monaco from '@codingame/monaco-vscode-editor-api'
import type { AIClassroomBridgeValue } from '@/lib/ai/classroom/bridge'
import { useCodeSuggestionStore } from '@/features/tour-ai/state/code-suggestion-store'
import { useQuizDraftStore } from '@/features/tour-ai/state/quiz-draft-store'
import { fail, ok } from './results'
import { getModel, requireClassroom, targetSnippet, withLineNumbers } from './shared'

const CHAT_MARKER_NAMESPACE = 'chat'

/**
 * Build the model URI a QuizPracticeCard would use for the given quiz id.
 *  Mirrors the `slot` computation in createEditorAppConfig.
 */
function quizModelUri(quizId: string): string {
  return `file:///playground/quiz-${encodeURIComponent(quizId)}/main.cj`
}

/**
 * Pick the right Monaco editor / model for "what the learner is looking at".
 *  Tries, in priority order:
 *    1. The currently focused Monaco editor (handles "user is actively typing
 *       in a quiz card right now").
 *    2. The bridge-registered editor (the active quiz card has registered
 *       itself; same signal QuizPracticeCard wires for write-tools).
 *    3. The model whose URI matches the active quiz id (handles cases where
 *       no quiz card is currently the registered one — e.g. quiz status
 *       changed to skip/success/superseded and the bridge useEffect dropped
 *       its registration, OR the chat ran before the quiz card mounted).
 *    4. Any quiz-shaped model in Monaco (multi-quiz pages where currentQuiz
 *       is null but old quiz cards still hold live models).
 *  Returns null when nothing usable exists; the caller falls further back to
 *  the persisted draft and then to the quiz's static starter code.
 */
function resolveLearnerCodeSource(bridge: AIClassroomBridgeValue): {
  code: string
  lineCount: number
  language: string
  source: 'focused' | 'bridge' | 'active_quiz_model' | 'detached_model'
  quizId?: string
} | null {
  // 1. focused
  const editors = monaco.editor.getEditors?.() ?? []
  const focused = editors.find(e => e.hasTextFocus?.())
  if (focused) {
    const m = focused.getModel()
    if (m) {
      return {
        code: m.getValue(),
        lineCount: m.getLineCount(),
        language: m.getLanguageId(),
        source: 'focused',
      }
    }
  }

  // 2. bridge-registered editor
  const bridgeEditor = bridge.editor.getEditor()
  const bridgeModel = bridgeEditor?.getModel?.()
  if (bridgeModel) {
    return {
      code: bridgeModel.getValue(),
      lineCount: bridgeModel.getLineCount(),
      language: bridgeModel.getLanguageId(),
      source: 'bridge',
    }
  }

  // 3. URI lookup for the active quiz — ignore status here so that a quiz
  //    that just transitioned to skip/success/superseded but whose model
  //    still holds the learner's last edit can still be read. The session
  //    `currentQuiz` field points to the most recent quiz the system cares
  //    about, regardless of terminal state.
  const session = bridge.classroom?.getSession()
  const currentQuiz = session?.currentQuiz
  if (currentQuiz && monaco.Uri?.parse && monaco.editor.getModel) {
    const uri = monaco.Uri.parse(quizModelUri(currentQuiz.id))
    const m = monaco.editor.getModel(uri)
    if (m) {
      return {
        code: m.getValue(),
        lineCount: m.getLineCount(),
        language: m.getLanguageId(),
        source: 'active_quiz_model',
        quizId: currentQuiz.id,
      }
    }
  }

  // 4. Any quiz-shaped model lying around. Order is undefined so this is a
  //    last-resort: prefer the one whose URI matches `currentQuiz.id` if we
  //    fell here because layer 3's strict `getModel(uri)` call failed for
  //    some reason (e.g. URI parser disagreement). Otherwise take the first.
  const allModels = monaco.editor.getModels?.() ?? []
  const quizModels = allModels.filter(m => m.uri.toString().startsWith('file:///playground/quiz-'))
  const detached = (currentQuiz
    ? quizModels.find(m => m.uri.toString() === quizModelUri(currentQuiz.id))
    : undefined) ?? quizModels[0]
  if (detached) {
    return {
      code: detached.getValue(),
      lineCount: detached.getLineCount(),
      language: detached.getLanguageId(),
      source: 'detached_model',
    }
  }

  return null
}

export function createEditorTools(bridge: AIClassroomBridgeValue): Toolkit {
  return {
    read_editor_code: {
      description: 'Read the learner\'s current quiz code. Always returns something — when the live editor is unavailable, falls back to the persisted draft and then to the quiz\'s starter code. Use withLineNumbers when discussing line-specific code. The returned `source` tells you whether you are looking at live focused code (`focused`), the current active-quiz model (`active_quiz_model`), a detached model, a persisted draft (`draft`), or the starter scaffold (`starter`).',
      parameters: z.object({ withLineNumbers: z.boolean().optional() }),
      execute: async ({ withLineNumbers: numbered }) => {
        const formatCode = (code: string) => numbered ? withLineNumbers(code) : code

        // Layers 1-3: live Monaco model.
        const live = resolveLearnerCodeSource(bridge)
        if (live) {
          return ok({
            code: formatCode(live.code),
            lineCount: live.lineCount,
            language: live.language,
            source: live.source,
            ...(live.quizId ? { quizId: live.quizId } : {}),
          })
        }

        // Layer 4: persisted draft for the active quiz.
        const session = bridge.classroom?.getSession()
        const activeQuiz = session?.currentQuiz
        if (activeQuiz) {
          const draft = useQuizDraftStore.getState().getDraft(activeQuiz.id)
          if (draft && draft.code) {
            return ok({
              code: formatCode(draft.code),
              lineCount: draft.code.split('\n').length,
              language: 'cangjie',
              source: 'draft' as const,
              quizId: activeQuiz.id,
              stale: true,
            })
          }
          // Layer 5: starter code — gives the AI enough context to talk about
          // the exercise even when the learner has not typed anything yet.
          return ok({
            code: formatCode(activeQuiz.starterCode),
            lineCount: activeQuiz.starterCode.split('\n').length,
            language: 'cangjie',
            source: 'starter' as const,
            quizId: activeQuiz.id,
            stale: true,
          })
        }

        return fail('No code to read — no active quiz and no live editor on the page.')
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

    suggest_code_change: {
      description: 'Stage a proposed code replacement for the active quiz without applying it. The learner sees a diff banner and decides whether to apply. Use this for "here is what I would write" — never silently rewrite the learner\'s code. Pass the full replacement source in `code`, the active quiz id in `quizId` (from read_current_quiz / read_classroom_state), and a one-paragraph rationale in `explanation`.',
      parameters: z.object({
        quizId: z.string(),
        code: z.string(),
        explanation: z.string().max(800),
      }),
      execute: async ({ quizId, code, explanation }) => {
        try {
          // Verify the suggestion targets the currently active quiz; refuse
          // stale or speculative targets so old suggestions don't leak into
          // the next exercise.
          const session = requireClassroom(bridge).getSession()
          const active = session.currentQuiz
          if (!active || active.status !== 'active')
            return fail('No active quiz; suggest_code_change can only run while a quiz is active.')
          if (active.id !== quizId)
            return fail(`Quiz id mismatch — active quiz is ${active.id}, but you targeted ${quizId}. Re-fetch via read_current_quiz before suggesting.`)
          useCodeSuggestionStore.getState().setSuggestion({
            quizId,
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
