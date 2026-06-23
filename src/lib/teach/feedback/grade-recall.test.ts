import { describe, expect, it, vi } from 'vitest'
import { generateText } from 'ai'
import type { LanguageModel } from 'ai'
import { gradeRecallAnswer, recallVerdictSchema } from './grade-recall'

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return {
    ...actual,
    generateText: vi.fn(),
  }
})

const mockGenerateText = vi.mocked(generateText)

const fakeModel = {} as LanguageModel

/** Build a generateText result that forces a single record_verdict tool call. */
function toolCallResult(input: { correct: boolean, feedback: string }) {
  return {
    toolCalls: [
      { type: 'tool-call', toolCallId: 'c1', toolName: 'record_verdict', input },
    ],
  } as never
}

describe('gradeRecallAnswer', () => {
  it('returns the parsed verdict from the forced tool call', async () => {
    mockGenerateText.mockResolvedValueOnce(
      toolCallResult({ correct: true, feedback: '关键要点都答到了。' }),
    )

    const verdict = await gradeRecallAnswer(
      { prompt: '如何声明不可变绑定？', reference: '使用 let', answer: '用 let 关键字' },
      { model: fakeModel },
    )

    expect(verdict).toEqual({ correct: true, feedback: '关键要点都答到了。' })
    expect(recallVerdictSchema.safeParse(verdict).success).toBe(true)
  })

  it('passes the model and forces a tool call into generateText', async () => {
    mockGenerateText.mockResolvedValueOnce(
      toolCallResult({ correct: false, feedback: '缺少关键点。' }),
    )

    await gradeRecallAnswer(
      { prompt: 'p', reference: 'r', answer: 'a' },
      { model: fakeModel },
    )

    const call = mockGenerateText.mock.calls.at(-1)![0] as Record<string, unknown>
    expect(call.model).toBe(fakeModel)
    expect(call.toolChoice).toBe('required')
    expect((call.tools as Record<string, unknown>).record_verdict).toBeDefined()
    expect(typeof call.prompt).toBe('string')
    expect(typeof call.system).toBe('string')
  })

  it('forwards the abort signal as abortSignal', async () => {
    mockGenerateText.mockResolvedValueOnce(
      toolCallResult({ correct: true, feedback: 'ok' }),
    )
    const controller = new AbortController()

    await gradeRecallAnswer(
      { prompt: 'p', reference: 'r', answer: 'a' },
      { model: fakeModel, signal: controller.signal },
    )

    const call = mockGenerateText.mock.calls.at(-1)![0] as Record<string, unknown>
    expect(call.abortSignal).toBe(controller.signal)
  })

  it('throws when the model returns no record_verdict tool call', async () => {
    mockGenerateText.mockResolvedValueOnce({ toolCalls: [] } as never)

    await expect(
      gradeRecallAnswer(
        { prompt: 'p', reference: 'r', answer: 'a' },
        { model: fakeModel },
      ),
    ).rejects.toThrow(/record_verdict/)
  })
})
