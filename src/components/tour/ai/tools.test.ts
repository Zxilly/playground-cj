import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Toolkit } from '@assistant-ui/react'
import type { AIBridgeValue } from '@/components/tour/EditorBridgeContext'
import { useLearnerStore } from '@/stores/learner'

// Skip the monaco wrapper that tools.ts imports — it pulls in CSS modules that
// vitest can't parse. We only exercise quiz-related tools, so monaco is never
// touched at runtime here either.
vi.mock('@codingame/monaco-vscode-editor-api', () => ({}))
// `@/service/run` chains through `@/const` which imports `.cj` example files —
// vite tries to parse those and chokes. Stub the service since the quiz tools
// never call it.
vi.mock('@/service/run', () => ({
  requestRemoteAction: vi.fn(),
}))

const fakeBridge = {
  uiLang: 'zh',
  lang: 'zh',
  allSections: [],
  editor: {
    getEditor: () => null,
  },
} as unknown as AIBridgeValue

let toolkit: Toolkit

afterEach(() => {
  useLearnerStore.getState().clear()
  if (typeof window !== 'undefined')
    window.localStorage.removeItem('tour-ai:learner:v1')
})

async function loadToolkit() {
  if (!toolkit) {
    const mod = await import('./tools')
    toolkit = mod.createBuiltinToolkit(fakeBridge)
  }
  return toolkit
}

describe('builtin toolkit / quiz tools', () => {
  it('set_quiz writes the active quiz with both locales when only one is provided', async () => {
    const tk = await loadToolkit()
    const result = await tk.set_quiz!.execute!({
      conceptId: 'cj.var.basic',
      prompt: { zh: '把 1 加到 2 并打印结果' },
      expectedOutput: '3',
    }, { toolCallId: 't', abortSignal: new AbortController().signal, human: async () => undefined }) as { ok: boolean, activeQuiz?: { prompt: { zh: string, en: string }, conceptId: string, attempts: number } }

    expect(result.ok).toBe(true)
    const stored = useLearnerStore.getState().learner.activeQuiz
    expect(stored).not.toBeNull()
    expect(stored?.conceptId).toBe('cj.var.basic')
    expect(stored?.prompt.zh).toBe('把 1 加到 2 并打印结果')
    expect(stored?.prompt.en).toBe('把 1 加到 2 并打印结果') // auto-copied
    expect(stored?.attempts).toBe(0)
    expect(stored?.matchMode).toBe('exact')
  })

  it('set_quiz refuses an empty prompt', async () => {
    const tk = await loadToolkit()
    const result = await tk.set_quiz!.execute!({
      conceptId: 'cj.var.basic',
      prompt: {},
      expectedOutput: '3',
    }, { toolCallId: 't', abortSignal: new AbortController().signal, human: async () => undefined }) as { ok: boolean, error?: string }

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/prompt/i)
    expect(useLearnerStore.getState().learner.activeQuiz ?? null).toBeNull()
  })

  it('clear_quiz nulls the active quiz', async () => {
    const tk = await loadToolkit()
    await tk.set_quiz!.execute!({
      conceptId: 'cj.var.basic',
      prompt: { zh: 'x', en: 'x' },
      expectedOutput: '3',
    }, { toolCallId: 't1', abortSignal: new AbortController().signal, human: async () => undefined })
    expect(useLearnerStore.getState().learner.activeQuiz).not.toBeNull()

    const result = await tk.clear_quiz!.execute!({}, { toolCallId: 't2', abortSignal: new AbortController().signal, human: async () => undefined }) as { ok: boolean, activeQuiz: unknown }
    expect(result.ok).toBe(true)
    expect(result.activeQuiz).toBeNull()
    expect(useLearnerStore.getState().learner.activeQuiz).toBeNull()
  })

  it('clear_quiz does not notify subscribers when no quiz is active', async () => {
    const tk = await loadToolkit()
    useLearnerStore.getState().setActiveQuiz(null)
    const listener = vi.fn()
    const unsubscribe = useLearnerStore.subscribe(listener)

    try {
      const result = await tk.clear_quiz!.execute!({}, { toolCallId: 't3', abortSignal: new AbortController().signal, human: async () => undefined }) as { ok: boolean, activeQuiz: unknown }

      expect(result.ok).toBe(true)
      expect(result.activeQuiz).toBeNull()
      expect(listener).not.toHaveBeenCalled()
    }
    finally {
      unsubscribe()
    }
  })

  it('set_quiz Zod schema rejects malformed (stringified) input', async () => {
    const tk = await loadToolkit()
    const schema = tk.set_quiz!.parameters as { safeParse?: (v: unknown) => { success: boolean } }
    expect(typeof schema.safeParse).toBe('function')
    // Model used to send the entire payload as a JSON string. With Zod hooked
    // into ai-sdk's validate path this is now caught at the schema boundary.
    const stringified = '{"conceptId":"cj.var.basic","prompt":{"zh":"x"},"expectedOutput":"3"}'
    expect(schema.safeParse!(stringified).success).toBe(false)
    expect(schema.safeParse!({ conceptId: 'cj.var.basic', prompt: { zh: 'x' }, expectedOutput: '3' }).success).toBe(true)
  })

  it('update_learner schema no longer carries a quiz field', async () => {
    const tk = await loadToolkit()
    const schema = tk.update_learner!.parameters as { _def?: { shape?: () => Record<string, unknown> }, shape?: Record<string, unknown> }
    // Zod v4 puts the shape under either `_def.shape()` or `shape` depending
    // on object kind; check both spellings without relying on internals.
    const shape = (schema as { shape?: Record<string, unknown> }).shape
      ?? (schema as { _def?: { shape?: () => Record<string, unknown> } })._def?.shape?.()
      ?? {}
    expect(Object.keys(shape)).not.toContain('quiz')
  })
})
