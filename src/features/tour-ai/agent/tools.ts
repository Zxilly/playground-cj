'use client'

import type { Toolkit } from '@assistant-ui/react'
import type { JSONSchema7 } from 'ai'
import { z } from 'zod'
import * as monaco from '@codingame/monaco-vscode-editor-api'
import type { AIClassroomBridgeValue, AIClassroomStateBridge } from '@/lib/ai/classroom/bridge'
import { getAllConcepts, getReadyConcepts } from '@/lib/ai/concept-graph/loader'
import { callMcpTool, listMcpTools } from '@/lib/mcp/client'
import { lessonContentBlockSchema, lessonContentBlocksSchema } from '@/lib/ai/classroom/schema'
import type { ClassroomSession } from '@/lib/ai/classroom/types'

const CHAT_MARKER_NAMESPACE = 'chat'

function ok<T extends object>(extra?: T) {
  return { ok: true as const, ...(extra ?? ({} as T)) } as { ok: true } & T
}

function fail(message: string) {
  return { ok: false as const, error: message }
}

function requireClassroom(bridge: AIClassroomBridgeValue): AIClassroomStateBridge {
  if (!bridge.classroom)
    throw new Error('Classroom state is not ready yet')
  return bridge.classroom
}

function getModel(bridge: AIClassroomBridgeValue) {
  const editor = bridge.editor.getEditor()
  const model = editor?.getModel()
  if (!model || !editor)
    throw new Error('Editor is not ready yet')
  return { editor, model }
}

function withLineNumbers(text: string): string {
  return text
    .split('\n')
    .map((line, i) => `${String(i + 1).padStart(4, ' ')}  ${line}`)
    .join('\n')
}

function demonstratedSet(session: ClassroomSession): Set<string> {
  return new Set(Object.values(session.learner.concepts)
    .filter(concept => concept.status === 'demonstrated')
    .map(concept => concept.conceptId))
}

function readConcepts(bridge: AIClassroomBridgeValue, ids?: string[]) {
  const classroom = requireClassroom(bridge)
  const session = classroom.getSession()
  const concepts = getAllConcepts()
  const selected = ids && ids.length > 0
    ? concepts.filter(concept => ids.includes(concept.conceptId))
    : getReadyConcepts(demonstratedSet(session)).slice(0, 20)

  return selected.map(concept => ({
    conceptId: concept.conceptId,
    title: concept.title[bridge.uiLang],
    summary: concept.summary[bridge.uiLang],
    difficulty: concept.difficulty,
    prerequisites: concept.prerequisites,
    status: session.learner.concepts[concept.conceptId]?.status ?? 'unseen',
  }))
}

function targetSnippet(model: monaco.editor.ITextModel, startLine: number, startColumn?: number, endColumn?: number): string {
  const line = model.getLineContent(startLine)
  if (startColumn && endColumn && endColumn > startColumn)
    return line.slice(startColumn - 1, endColumn - 1).trim()
  return line.trim()
}

const readConceptsParameters = z.object({
  ids: z.array(z.string()).optional(),
})

const mcpCallParameters = z.object({
  name: z.string(),
  arguments: z.record(z.string(), z.unknown()).optional(),
})

export function createClassroomChatToolkit(bridge: AIClassroomBridgeValue): Toolkit {
  return {
    read_classroom_state: {
      description: 'Read the current classroom state summary, phase, learner evidence, and pending action. Does not return the full stream.',
      parameters: z.object({}),
      execute: async () => {
        try {
          const session = requireClassroom(bridge).getSession()
          return ok({
            phase: session.phase,
            pendingAction: session.pendingAction,
            sessionSummary: session.sessionSummary,
            learner: session.learner,
            currentQuiz: session.currentQuiz,
          })
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    read_current_quiz: {
      description: 'Read the active quiz, if any. Use this to answer quiz questions; do not complete or skip it.',
      parameters: z.object({}),
      execute: async () => {
        try {
          return ok({ currentQuiz: requireClassroom(bridge).getSession().currentQuiz })
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

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

    read_last_run: {
      description: 'Read the latest deterministic runner result.',
      parameters: z.object({}),
      execute: async () => {
        try {
          return ok({ lastRun: requireClassroom(bridge).getSession().lastRun })
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    read_concepts: {
      description: 'Read Cangjie concept graph metadata and classroom concept status. Returns no references/provenance.',
      parameters: readConceptsParameters,
      execute: async ({ ids }) => {
        try {
          return ok({ concepts: readConcepts(bridge, ids) })
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    mcp_call_tool: {
      description: 'Call an MCP documentation tool by name. Use internally for correctness; do not surface citations or references.',
      parameters: mcpCallParameters,
      execute: async ({ name, arguments: args }) => {
        try {
          return ok({ result: await callMcpTool(name, args ?? {}) })
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    emit_classroom_event: {
      description: 'Emit a structured learner intent for the lesson generation flow. Use when the learner asks to go deeper, slow down, change topic, or advance.',
      parameters: z.object({
        intent: z.string(),
        summary: z.string(),
      }),
      execute: async ({ intent, summary }) => {
        try {
          requireClassroom(bridge).dispatch({
            type: 'EMIT_CHAT_INTENT',
            intent,
            summary,
            now: Date.now(),
          })
          return ok()
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

export function createLessonGenerationToolkit(bridge: AIClassroomBridgeValue): Toolkit {
  return {
    read_classroom_state: {
      description: 'Read the current classroom session summary and learner state. Does not expose internal task/run identifiers.',
      parameters: z.object({}),
      execute: async () => {
        try {
          const session = requireClassroom(bridge).getSession()
          return ok({
            phase: session.phase,
            pendingAction: session.pendingAction,
            sessionSummary: session.sessionSummary,
            learner: session.learner,
            currentQuiz: session.currentQuiz,
            lastRun: session.lastRun,
            queuedEvents: session.eventQueue,
          })
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    read_concepts: {
      description: 'Read Cangjie concept graph metadata and classroom concept status. Returns no references/provenance.',
      parameters: readConceptsParameters,
      execute: async ({ ids }) => {
        try {
          return ok({ concepts: readConcepts(bridge, ids) })
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    mcp_call_tool: {
      description: 'Call an MCP documentation tool by name. Use internally for correctness; do not surface citations or references.',
      parameters: mcpCallParameters,
      execute: async ({ name, arguments: args }) => {
        try {
          return ok({ result: await callMcpTool(name, args ?? {}) })
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    append_lesson_content: {
      description: 'Append official lesson content blocks using the classroom DSL. Do not output MDX/HTML/provenance fields.',
      parameters: z.object({
        blocks: lessonContentBlocksSchema,
      }),
      execute: async ({ blocks }) => {
        try {
          const parsed = lessonContentBlocksSchema.parse(blocks)
          requireClassroom(bridge).dispatch({
            type: 'APPEND_LESSON_CONTENT',
            blocks: parsed,
            now: Date.now(),
          })
          return ok({ appended: parsed.length })
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    set_current_quiz: {
      description: 'Set the current active quiz using the DSL quiz block.',
      parameters: z.object({
        quiz: lessonContentBlockSchema,
      }),
      execute: async ({ quiz }) => {
        try {
          const parsed = lessonContentBlockSchema.parse(quiz)
          if (parsed.type !== 'quiz')
            return fail('set_current_quiz requires a quiz block.')
          requireClassroom(bridge).dispatch({
            type: 'SET_CURRENT_QUIZ',
            quiz: parsed,
            now: Date.now(),
          })
          return ok({ currentQuiz: parsed })
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    set_phase: {
      description: 'Set classroom phase to orient, teach, or practice.',
      parameters: z.object({
        phase: z.union([z.literal('orient'), z.literal('teach'), z.literal('practice')]),
      }),
      execute: async ({ phase }) => {
        try {
          requireClassroom(bridge).dispatch({ type: 'SET_PHASE', phase, now: Date.now() })
          return ok()
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    set_learning_notes: {
      description: 'Set concise learner notes for future lesson generation steps.',
      parameters: z.object({
        notes: z.string().max(500),
      }),
      execute: async ({ notes }) => {
        try {
          requireClassroom(bridge).dispatch({ type: 'SET_LEARNING_NOTES', notes, now: Date.now() })
          return ok()
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },
  }
}

const MCP_PREFIX = 'mcp_'
const MAX_TOOL_NAME_LENGTH = 64

function encodeToolNameSegment(raw: string): string {
  return raw.replace(/[^A-Za-z0-9_]/gu, (ch) => {
    const cp = ch.codePointAt(0) ?? 0
    const hex = cp.toString(16).padStart(cp > 0xFFFF ? 6 : cp > 0xFF ? 4 : 2, '0')
    return `_x${hex}_`
  })
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function safeMcpName(raw: string): Promise<string> {
  const full = `${MCP_PREFIX}${encodeToolNameSegment(raw)}`
  if (full.length <= MAX_TOOL_NAME_LENGTH)
    return full
  const hash = await sha256Hex(raw)
  const suffix = `__${hash.slice(0, 8)}`
  return `${full.slice(0, MAX_TOOL_NAME_LENGTH - suffix.length)}${suffix}`
}

export async function loadMcpToolkit(): Promise<Toolkit> {
  try {
    const descriptors = await listMcpTools()
    const out: Toolkit = {}
    for (const desc of descriptors) {
      const safeName = await safeMcpName(desc.name)
      const schema: JSONSchema7 = (desc.inputSchema as JSONSchema7 | undefined) ?? { type: 'object' }
      out[safeName] = {
        description: desc.description ?? `MCP tool: ${desc.name}`,
        parameters: schema,
        execute: async (args: Record<string, unknown>) => {
          try {
            return await callMcpTool(desc.name, args)
          }
          catch (e) {
            return fail((e as Error).message)
          }
        },
      }
    }
    return out
  }
  catch (err) {
    console.warn('[MCP] failed to load tools', err)
    return {}
  }
}
