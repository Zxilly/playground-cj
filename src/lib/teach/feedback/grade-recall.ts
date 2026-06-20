import { generateObject } from 'ai'
import type { LanguageModel } from 'ai'
import { z } from 'zod'

/**
 * The verdict an LLM judge returns for a free-recall answer: whether the
 * learner's from-memory answer captured the reference's key points, plus a
 * one-sentence Chinese feedback to surface in the block.
 */
export const recallVerdictSchema = z.object({
  correct: z.boolean(),
  feedback: z.string(),
})

export type RecallVerdict = z.infer<typeof recallVerdictSchema>

/**
 * Grade a learner's free-recall answer against the reference answer with the
 * configured model. We lean lenient on wording (recall practice cares about
 * the ideas, not phrasing) but strict on missing or wrong key points.
 */
export async function gradeRecallAnswer(
  params: { prompt: string, reference: string, answer: string },
  deps: { model: LanguageModel, signal?: AbortSignal },
): Promise<RecallVerdict> {
  const { object } = await generateObject({
    model: deps.model,
    schema: recallVerdictSchema,
    abortSignal: deps.signal,
    system: '你是仓颉语言的授课老师。请判断学习者凭记忆写下的答案是否抓住了参考答案的关键要点：措辞宽松对待，只要意思到位即可；但对遗漏或错误的关键要点要严格。',
    prompt: [
      `回忆题目：${params.prompt}`,
      `参考答案：${params.reference}`,
      `学习者作答：${params.answer}`,
      '请判断该作答是否已掌握关键要点，并给出一句中文反馈。',
    ].join('\n'),
  })
  return object
}
