'use client'

import type { Toolkit } from '@assistant-ui/react'
import type { JSONSchema7 } from 'ai'
import { z } from 'zod'
import * as monaco from '@codingame/monaco-vscode-editor-api'
import type { AIBridgeValue } from '@/components/tour/EditorBridgeContext'
import { applyEdit, applyFullReplace, applyInsertAtLine } from '@/lib/ai/monaco-edit'
import {
  applyConceptStatus,
  applyEvidence,
  CONCEPT_STATUSES,
  EVIDENCE_OUTCOMES,
  getDemonstratedSet,
  getRelevantConcepts,
  newQuizId,
  QUIZ_MATCH_MODES,
} from '@/lib/ai/learner-model'
import type { ConceptProgress, ConceptStatus } from '@/lib/ai/learner-model'
import { readLearner, useLearnerStore } from '@/stores/learner'
import { useTourEditorStore } from '@/stores/tourEditor'
import { findChapterRefSections, getAllConcepts, getConcept, getReadyConcepts } from '@/lib/ai/concept-graph/loader'
import { buildQuizHints, evaluateQuiz } from '@/lib/ai/quiz-evaluator'
import { callMcpTool, listMcpTools } from '@/lib/mcp/client'
import { requestRemoteAction } from '@/service/run'

const MARKDOWN_SUMMARY_CHARS = 600

function withLineNumbers(text: string): string {
  return text
    .split('\n')
    .map((line, i) => `${String(i + 1).padStart(4, ' ')}  ${line}`)
    .join('\n')
}

function getModel(bridge: AIBridgeValue) {
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

function truncate(s: string, n: number): string {
  if (s.length <= n)
    return s
  return `${s.slice(0, n)}\n…[truncated; call read_concepts with materials='full' for the rest]`
}

function statusOf(c: ConceptProgress | undefined): ConceptStatus {
  return c?.status ?? 'unseen'
}

const MATERIAL_MODES = ['none', 'titles', 'summary', 'full'] as const
type MaterialMode = typeof MATERIAL_MODES[number]

export function createBuiltinToolkit(bridge: AIBridgeValue): Toolkit {
  const { uiLang } = bridge

  return {
    read_concepts: {
      description: 'Read the Cangjie concept graph. Without ids: returns ready / in-progress / blocked / recently-touched concepts only (capped) plus a totalCount. With ids: returns full metadata + linked tour materials. Use materials=\'titles\' (default for detail) to skip markdown; \'summary\' for a 600-char excerpt; \'full\' for the entire chapter markdown.',
      parameters: z.object({
        ids: z.array(z.string()).optional(),
        materials: z.enum(MATERIAL_MODES).optional(),
      }),
      execute: async ({ ids, materials }) => {
        const learner = readLearner()

        if (!ids || ids.length === 0) {
          const all = getAllConcepts()
          const ready = new Set(getReadyConcepts(getDemonstratedSet(learner)).map(n => n.conceptId))
          const interesting = all.filter((n) => {
            const s = statusOf(learner.concepts[n.conceptId])
            return ready.has(n.conceptId) || s === 'practicing' || s === 'blocked' || s === 'demonstrated' || s === 'exposed'
          })
          const items = interesting.slice(0, 20).map(n => ({
            conceptId: n.conceptId,
            title: n.title[uiLang],
            difficulty: n.difficulty,
            prerequisites: n.prerequisites,
            status: statusOf(learner.concepts[n.conceptId]),
            ready: ready.has(n.conceptId),
          }))
          return ok({
            concepts: items,
            totalCount: all.length,
            note: items.length < interesting.length
              ? `Showing ${items.length} of ${interesting.length} interesting concepts. Pass ids=[...] for specifics.`
              : undefined,
          })
        }

        const mode: MaterialMode = materials ?? 'titles'
        const details = ids.map((id: string) => {
          const node = getConcept(id)
          if (!node)
            return { conceptId: id, error: 'not found' }

          const sections = mode === 'none'
            ? []
            : node.chapterRefs.flatMap(ref => findChapterRefSections(ref, bridge.allSections))

          const materialsOut = sections.map((s) => {
            const md = s.markdown[uiLang] || s.markdown.zh || ''
            const code = s.code[uiLang] || s.code.zh || ''
            const base = {
              ref: `${s.chapterId}/${s.subChapterId}/${s.sectionId}`,
              title: s.sectionName[uiLang],
              chapter: s.chapterName[uiLang],
            }
            if (mode === 'titles')
              return base
            if (mode === 'summary')
              return { ...base, markdownSummary: truncate(md, MARKDOWN_SUMMARY_CHARS), sampleCode: code }
            return { ...base, markdown: md, sampleCode: code }
          })

          const prerequisitesStatus = Object.fromEntries(
            node.prerequisites.map(p => [p, statusOf(learner.concepts[p])]),
          )

          return {
            conceptId: node.conceptId,
            title: node.title[uiLang],
            summary: node.summary[uiLang],
            difficulty: node.difficulty,
            prerequisites: node.prerequisites,
            prerequisitesStatus,
            commonMisconceptions: node.commonMisconceptions?.map(m => m[uiLang]) ?? [],
            docRefs: node.docRefs ?? [],
            status: statusOf(learner.concepts[id]),
            evidenceCount: learner.concepts[id]?.evidenceCount,
            materials: materialsOut,
          }
        })
        return ok({ concepts: details, materialsMode: mode })
      },
    },

    read_learner: {
      description: 'Read the learner profile. Returns knownLanguages, agentNotesSummary, ready concepts (hard prereqs all demonstrated/mastered), in-progress / blocked / recently-touched concept progress (capped), and the active quiz if any. Call before making teaching decisions; pure conversational replies do not require this.',
      parameters: z.object({}),
      execute: async () => {
        const m = readLearner()
        const ready = getReadyConcepts(getDemonstratedSet(m)).slice(0, 8).map(n => n.conceptId)
        const concepts = Object.fromEntries(getRelevantConcepts(m).map(c => [c.conceptId, c]))
        return ok({
          knownLanguages: m.knownLanguages,
          agentNotesSummary: m.agentNotesSummary ?? null,
          concepts,
          conceptCount: Object.keys(m.concepts).length,
          readyConceptIds: ready,
          activeQuiz: m.activeQuiz ?? null,
        })
      },
    },

    update_learner: {
      description: 'Single write tool for the learner profile. All fields optional. `concept` updates one concept (status / evidence / notes). For quiz creation/cancellation use the dedicated `set_quiz` / `clear_quiz` tools.',
      parameters: z.object({
        knownLanguages: z.array(z.string()).optional(),
        agentNotesSummary: z.string().max(300).optional(),
        concept: z.object({
          id: z.string(),
          status: z.enum(CONCEPT_STATUSES).optional(),
          evidence: z.enum(EVIDENCE_OUTCOMES).optional(),
          notes: z.string().max(280).optional(),
        }).optional(),
      }),
      execute: async (input) => {
        try {
          let rejected: string | undefined
          let touchedConceptId: string | undefined
          const m = useLearnerStore.getState().mutate((m) => {
            if (input.knownLanguages)
              m.knownLanguages = Array.from(new Set(input.knownLanguages))
            if (input.agentNotesSummary !== undefined)
              m.agentNotesSummary = input.agentNotesSummary.length > 0 ? input.agentNotesSummary.slice(0, 300) : undefined

            if (input.concept) {
              const { id, status, evidence, notes } = input.concept
              touchedConceptId = id

              if (status === 'mastered') {
                const node = getConcept(id)
                const allPrereqsDone = node?.prerequisites.every((p) => {
                  const s = statusOf(m.concepts[p])
                  return s === 'demonstrated' || s === 'mastered'
                }) ?? true
                if (!allPrereqsDone) {
                  rejected = `Cannot set ${id} to "mastered" — at least one hard prerequisite is below demonstrated. Teach the prereqs first or use status="demonstrated" for now.`
                  return
                }
              }

              if (status || notes !== undefined)
                applyConceptStatus(m, id, status ?? statusOf(m.concepts[id]), notes)
              if (evidence)
                applyEvidence(m, id, evidence)
            }
          })

          if (rejected)
            return fail(rejected)

          return ok({
            knownLanguages: m.knownLanguages,
            agentNotesSummary: m.agentNotesSummary ?? null,
            concept: touchedConceptId ? m.concepts[touchedConceptId] ?? null : undefined,
          })
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    set_quiz: {
      description: 'Set or replace the active OJ-style quiz. The learner sees the prompt in the quiz panel; their next run_code call will auto-evaluate program output against expectedOutput. Pass at least one of prompt.zh / prompt.en — the missing locale is auto-copied. Default matchMode is "exact" (trailing whitespace trimmed). Setting a new quiz replaces the old one.',
      parameters: z.object({
        conceptId: z.string(),
        prompt: z.object({ zh: z.string().optional(), en: z.string().optional() }),
        expectedOutput: z.string(),
        matchMode: z.enum(QUIZ_MATCH_MODES).optional(),
      }),
      execute: async ({ conceptId, prompt, expectedOutput, matchMode }) => {
        try {
          const zh = prompt.zh ?? prompt.en ?? ''
          const en = prompt.en ?? prompt.zh ?? ''
          if (!zh && !en)
            return fail('Quiz prompt must include at least zh or en.')
          const m = useLearnerStore.getState().mutate((m) => {
            m.activeQuiz = {
              quizId: newQuizId(),
              conceptId,
              prompt: { zh, en },
              expectedOutput,
              matchMode: matchMode ?? 'exact',
              startedAt: Date.now(),
              attempts: 0,
            }
          })
          return ok({ activeQuiz: m.activeQuiz })
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    clear_quiz: {
      description: 'Clear the active quiz (e.g. learner gives up, or you decide to switch concepts). No-op if no quiz is active.',
      parameters: z.object({}),
      execute: async () => {
        try {
          const current = useLearnerStore.getState().learner
          if (current.activeQuiz == null)
            return ok({ activeQuiz: null })

          const m = useLearnerStore.getState().mutate((m) => {
            m.activeQuiz = null
          })
          return ok({ activeQuiz: m.activeQuiz ?? null })
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },

    read_editor_code: {
      description: 'Read the current Monaco editor content. Set withLineNumbers=true when discussing specific lines.',
      parameters: z.object({ withLineNumbers: z.boolean().optional() }),
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
      description: 'Replace the entire editor content. Use only for opening a fresh exercise scaffold or large rewrites — prefer edit_editor_code for small changes.',
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
      description: 'Targeted text replacement on the editor. oldString must uniquely identify the location (include surrounding context). Use replaceAll only when every occurrence should change.',
      parameters: z.object({
        oldString: z.string(),
        newString: z.string(),
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
      description: 'Insert text before the given 1-based line. Useful for adding imports or new statements.',
      parameters: z.object({ line: z.number().int().min(1), text: z.string() }),
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
      description: 'Compile and run the current editor code. Returns compiler diagnostics + program stdout/stderr. If a quiz is active, ALSO compares output against the expectation and writes a success / failed evidence entry. NOTE: passing a quiz only records the evidence — you must still decide whether to upgrade concept status.',
      parameters: z.object({}),
      execute: async () => {
        try {
          const { model } = getModel(bridge)
          const code = model.getValue()
          const data = await requestRemoteAction(code, 'run')
          useTourEditorStore.getState().setLatestOutput({
            compilerOutput: data.compiler_output,
            programOutput: data.bin_output,
          })

          const base = {
            compilerOutput: data.compiler_output,
            compilerCode: data.compiler_code,
            programOutput: data.bin_output,
            programCode: data.bin_code,
          }

          if (!readLearner().activeQuiz)
            return ok(base)

          let evalResult: ReturnType<typeof evaluateQuiz> | null = null
          let evaluatedQuiz: ReturnType<typeof readLearner>['activeQuiz'] = null
          let conceptAfter: ConceptProgress | undefined

          useLearnerStore.getState().mutate((m) => {
            if (!m.activeQuiz)
              return
            m.activeQuiz.attempts += 1
            evaluatedQuiz = { ...m.activeQuiz }
            evalResult = evaluateQuiz(m.activeQuiz, data.bin_output ?? '')
            applyEvidence(m, m.activeQuiz.conceptId, evalResult.matched ? 'success' : 'failed')
            if (evalResult.matched)
              m.activeQuiz = null
            conceptAfter = m.concepts[evaluatedQuiz.conceptId]
          })

          if (!evalResult || !evaluatedQuiz)
            return ok(base)
          const er = evalResult as ReturnType<typeof evaluateQuiz>
          const eq = evaluatedQuiz as NonNullable<ReturnType<typeof readLearner>['activeQuiz']>
          return ok({
            ...base,
            quiz: {
              quizId: eq.quizId,
              conceptId: eq.conceptId,
              attempts: eq.attempts,
              matched: er.matched,
              expected: er.expected,
              actual: er.actual,
              diff: er.diff,
              hints: buildQuizHints(er.matched, eq.attempts),
              conceptAfter: conceptAfter ?? null,
            },
          })
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
      description: 'Reset the editor to the initial code stashed when this AI session started. Useful after a botched experiment.',
      parameters: z.object({}),
      execute: async () => {
        try {
          const { model } = getModel(bridge)
          const initial = useTourEditorStore.getState().initialCode
          const result = await applyFullReplace(model, initial)
          return ok(result)
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
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
