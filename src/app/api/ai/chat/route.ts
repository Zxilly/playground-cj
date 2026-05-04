import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { frontendTools } from '@assistant-ui/react-ai-sdk'
import { convertToModelMessages, stepCountIs, streamText } from 'ai'
import type { JSONSchema7, UIMessage } from 'ai'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const baseURL = req.headers.get('x-llm-base-url') || 'https://cj-api.learningman.top/llm/v1'
  const apiKey = req.headers.get('x-llm-api-key') || 'public'
  const modelId = req.headers.get('x-llm-model') || 'gpt-4o-mini'

  const {
    messages,
    system,
    tools,
  }: {
    messages: UIMessage[]
    system?: string
    tools?: Record<string, { description?: string, parameters: JSONSchema7 }>
  } = await req.json()

  // openai-compatible always targets /chat/completions and forwards tools as
  // standard OpenAI function calls — no /responses-API quirks.
  const provider = createOpenAICompatible({
    name: 'tour-llm',
    baseURL,
    apiKey,
  })

  const result = streamText({
    model: provider(modelId),
    messages: await convertToModelMessages(messages),
    ...(system ? { system } : {}),
    stopWhen: stepCountIs(12),
    tools: frontendTools(tools ?? {}),
  })

  return result.toUIMessageStreamResponse()
}
