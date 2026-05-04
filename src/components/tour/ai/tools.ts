'use client'

// We expose tools as a plain `Toolkit` (per the assistant-ui canonical
// `Tools()` API). Each entry is `{ description, parameters, execute }`.
// Registration happens once via `useAui({ tools: Tools({ toolkit }) })` in
// TourAIChat — no component-level hooks (the deprecated `useAssistantTool`
// pattern caused duplicate registrations on remount).
import type { Toolkit } from '@assistant-ui/react'
import type { JSONSchema7 } from 'ai'
import { z } from 'zod'
import * as monaco from '@codingame/monaco-vscode-editor-api'
import type { TourBridgeValue } from '@/components/tour/EditorBridgeContext'
import { applyEdit, applyFullReplace, applyInsertAtLine } from '@/lib/ai/monaco-edit'
import { listProgress, recordProgress } from '@/lib/ai/progress'
import { sectionKey } from '@/lib/ai/persistence'
import { callMcpTool, listMcpTools } from '@/lib/mcp/client'
import { requestRemoteAction } from '@/service/run'

function withLineNumbers(text: string): string {
  return text
    .split('\n')
    .map((line, i) => `${String(i + 1).padStart(4, ' ')}  ${line}`)
    .join('\n')
}

function getModel(bridge: TourBridgeValue) {
  const editor = bridge.editor.getEditor()
  const model = editor?.getModel()
  if (!model || !editor)
    throw new Error('Editor is not ready yet')
  return { editor, model }
}

function ok<T extends object>(extra?: T) {
  return { ok: true as const, ...(extra ?? ({} as T)) } as { ok: true } & T
}

function fail(message: string) {
  return { ok: false as const, error: message }
}

async function runCodeAndAwait(bridge: TourBridgeValue) {
  const { model } = getModel(bridge)
  const code = model.getValue()
  const data = await requestRemoteAction(code, 'run')
  bridge.editor.setLatestOutput({
    compilerOutput: data.compiler_output,
    programOutput: data.bin_output,
  })
  return {
    compilerOutput: data.compiler_output,
    compilerCode: data.compiler_code,
    programOutput: data.bin_output,
    programCode: data.bin_code,
  }
}

export function createBuiltinToolkit(bridge: TourBridgeValue): Toolkit {
  const sk = sectionKey(bridge.lang, bridge.section.chapterId, bridge.section.subChapterId, bridge.section.sectionId)

  return {
    read_tutorial: {
      description: 'Read the current tutorial section markdown for the active language. Use before answering content questions.',
      parameters: z.object({}),
      execute: async () => {
        const lang = bridge.lang
        const md = bridge.section.markdown[lang] || bridge.section.markdown.zh || ''
        const title = bridge.section.sectionName[lang] || bridge.section.sectionName.zh
        return ok({
          title,
          markdown: md,
          chapterId: bridge.section.chapterId,
          subChapterId: bridge.section.subChapterId,
          sectionId: bridge.section.sectionId,
        })
      },
    },

    list_sections: {
      description: 'List every section across the whole tour. Use when the user asks for an overview or wants to navigate.',
      parameters: z.object({}),
      execute: async () => {
        const lang = bridge.lang
        return ok({
          sections: bridge.allSections.map((s, idx) => ({
            index: idx,
            chapterId: s.chapterId,
            chapterSlug: s.chapterSlug,
            subChapterId: s.subChapterId,
            sectionId: s.sectionId,
            chapterName: s.chapterName[lang] || s.chapterName.zh,
            subChapterName: s.subChapterName[lang] || s.subChapterName.zh,
            sectionName: s.sectionName[lang] || s.sectionName.zh,
          })),
        })
      },
    },

    navigate_section: {
      description: 'Navigate the user to a different section. Always call record_progress first.',
      parameters: z.object({
        chapterId: z.string(),
        subChapterId: z.string(),
        sectionId: z.string(),
      }),
      execute: async ({ chapterId, subChapterId, sectionId }) => {
        bridge.goToSection(chapterId, subChapterId, sectionId)
        return ok()
      },
    },

    read_editor_code: {
      description: 'Read the current Monaco editor content. Set withLineNumbers=true when the user asks about specific lines.',
      parameters: z.object({
        withLineNumbers: z.boolean().optional(),
      }),
      execute: async ({ withLineNumbers: lineNumbers }) => {
        try {
          const { model } = getModel(bridge)
          const code = model.getValue()
          return ok({
            code: lineNumbers ? withLineNumbers(code) : code,
            lineCount: model.getLineCount(),
            language: model.getLanguageId(),
          })
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    replace_editor_code: {
      description: 'Replace the entire editor content. Use only for large rewrites; prefer edit_editor_code for small changes.',
      parameters: z.object({
        code: z.string().describe('The new full Cangjie source code'),
      }),
      execute: async ({ code }) => {
        try {
          const { model } = getModel(bridge)
          const result = await applyFullReplace(model, code)
          return ok(result)
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    edit_editor_code: {
      description: 'Apply a targeted text replacement on the editor. oldString must uniquely identify the location (include surrounding context lines if necessary). Set replaceAll=true only when every occurrence should change.',
      parameters: z.object({
        oldString: z.string().describe('Exact substring to find. Include enough context to be unique.'),
        newString: z.string().describe('Replacement text. Must differ from oldString.'),
        replaceAll: z.boolean().optional(),
      }),
      execute: async ({ oldString, newString, replaceAll }) => {
        try {
          const { model } = getModel(bridge)
          const result = await applyEdit(model, oldString, newString, replaceAll ?? false)
          return ok(result)
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    insert_at_line: {
      description: 'Insert text before the given 1-based line. Useful for adding new statements or imports.',
      parameters: z.object({
        line: z.number().int().min(1),
        text: z.string(),
      }),
      execute: async ({ line, text }) => {
        try {
          const { model } = getModel(bridge)
          const result = await applyInsertAtLine(model, line, text)
          return ok(result)
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    run_code: {
      description: 'Compile and run the current editor code. Returns compiler diagnostics and program stdout/stderr.',
      parameters: z.object({}),
      execute: async () => {
        try {
          const out = await runCodeAndAwait(bridge)
          return ok(out)
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    format_code: {
      description: 'Run cjfmt on the current editor code.',
      parameters: z.object({}),
      execute: async () => {
        try {
          const { editor } = getModel(bridge)
          editor.getAction('editor.action.formatDocument')?.run()
          return ok()
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    get_diagnostics: {
      description: 'Read Monaco diagnostics (LSP + last compile result) for the current editor.',
      parameters: z.object({}),
      execute: async () => {
        try {
          const { model } = getModel(bridge)
          const markers = monaco.editor.getModelMarkers({ resource: model.uri })
          return ok({
            markers: markers.map(m => ({
              line: m.startLineNumber,
              col: m.startColumn,
              endLine: m.endLineNumber,
              endCol: m.endColumn,
              severity: m.severity,
              message: m.message,
              source: m.source,
            })),
          })
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    reset_editor_to_initial: {
      description: 'Reset the editor to the original example code shipped with this section.',
      parameters: z.object({}),
      execute: async () => {
        try {
          const { model } = getModel(bridge)
          const initial = bridge.editor.getInitialCode()
          const result = await applyFullReplace(model, initial)
          return ok(result)
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    record_progress: {
      description: 'Persist learner progress for the current section.',
      parameters: z.object({
        status: z.enum(['started', 'completed', 'skipped']),
        note: z.string().optional(),
      }),
      execute: async ({ status, note }) => {
        const entry = recordProgress(sk, status, note)
        return ok({ entry })
      },
    },

    list_progress: {
      description: 'List progress entries for every section the learner has touched.',
      parameters: z.object({}),
      execute: async () => ok({ entries: listProgress() }),
    },
  }
}

const MCP_PREFIX = 'mcp_'

function safeMcpName(raw: string): string {
  return `${MCP_PREFIX}${raw.replace(/\W/g, '_')}`
}

export async function loadMcpToolkit(): Promise<Toolkit> {
  try {
    const descriptors = await listMcpTools()
    const out: Toolkit = {}
    for (const desc of descriptors) {
      const safeName = safeMcpName(desc.name)
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

export function describeSectionPath(bridge: TourBridgeValue): string {
  const lang = bridge.lang
  const s = bridge.section
  return [
    s.chapterName[lang] || s.chapterName.zh,
    s.subChapterName[lang] || s.subChapterName.zh,
    s.sectionName[lang] || s.sectionName.zh,
  ].join(' / ')
}
