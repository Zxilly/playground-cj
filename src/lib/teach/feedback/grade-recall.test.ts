import { describe, expect, it, vi } from 'vitest'
import { generateObject } from 'ai'
import type { LanguageModel } from 'ai'
import { gradeRecallAnswer, recallVerdictSchema } from './grade-recall'

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}))

const mockGenerateObject = vi.mocked(generateObject)

const fakeModel = {} as LanguageModel

describe('gradeRecallAnswer', () => {
  it('returns the parsed verdict object from generateObject', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: { correct: true, feedback: '关键要点都答到了。' },
    } as never)

    const verdict = await gradeRecallAnswer(
      { prompt: '如何声明不可变绑定？', reference: '使用 let', answer: '用 let 关键字' },
      { model: fakeModel },
    )

    expect(verdict).toEqual({ correct: true, feedback: '关键要点都答到了。' })
    expect(recallVerdictSchema.safeParse(verdict).success).toBe(true)
  })

  it('passes the model and schema into generateObject', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: { correct: false, feedback: '缺少关键点。' },
    } as never)

    await gradeRecallAnswer(
      { prompt: 'p', reference: 'r', answer: 'a' },
      { model: fakeModel },
    )

    const call = mockGenerateObject.mock.calls.at(-1)![0] as Record<string, unknown>
    expect(call.model).toBe(fakeModel)
    expect(call.schema).toBe(recallVerdictSchema)
    expect(typeof call.prompt).toBe('string')
    expect(typeof call.system).toBe('string')
  })

  it('forwards the abort signal as abortSignal', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: { correct: true, feedback: 'ok' },
    } as never)
    const controller = new AbortController()

    await gradeRecallAnswer(
      { prompt: 'p', reference: 'r', answer: 'a' },
      { model: fakeModel, signal: controller.signal },
    )

    const call = mockGenerateObject.mock.calls.at(-1)![0] as Record<string, unknown>
    expect(call.abortSignal).toBe(controller.signal)
  })
})
