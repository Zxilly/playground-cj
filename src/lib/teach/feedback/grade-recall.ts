import { generateText, tool } from 'ai'
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
 *
 * The verdict is obtained via *tool calling* rather than `generateObject`: the
 * default shared model (mimo-v2.5-pro, served over an OpenAI-compatible
 * endpoint) does not support JSON-schema `response_format` / structured
 * outputs, so `generateObject` fails for it. The same model reliably calls
 * tools (the teacher agent does so for set_mission/run_code/etc.), so we force
 * a single `record_verdict` tool call (`toolChoice: 'required'`) and read the
 * structured `{ correct, feedback }` from its validated input.
 */
export async function gradeRecallAnswer(
  params: { prompt: string, reference: string, answer: string },
  deps: { model: LanguageModel, signal?: AbortSignal },
): Promise<RecallVerdict> {
  const { toolCalls } = await generateText({
    model: deps.model,
    abortSignal: deps.signal,
    toolChoice: 'required',
    tools: {
      record_verdict: tool({
        description: '记录对学习者回忆作答的批改结论：是否已掌握关键要点，以及一句中文反馈。',
        inputSchema: recallVerdictSchema,
      }),
    },
    system: '你是仓颉语言的授课老师。请判断学习者凭记忆写下的答案是否抓住了参考答案的关键要点：措辞宽松对待，只要意思到位即可；但对遗漏或错误的关键要点要严格。判断后，调用 record_verdict 工具记录结论。',
    prompt: [
      `回忆题目：${params.prompt}`,
      `参考答案：${params.reference}`,
      `学习者作答：${params.answer}`,
      '请判断该作答是否已掌握关键要点，并给出一句中文反馈，然后调用 record_verdict 工具记录结论。',
    ].join('\n'),
  })

  const verdictCall = toolCalls.find(call => call.toolName === 'record_verdict')
  if (!verdictCall)
    throw new Error('Recall grading model did not call record_verdict.')

  return recallVerdictSchema.parse(verdictCall.input)
}
