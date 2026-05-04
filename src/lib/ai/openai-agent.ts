'use client'

import type { Toolkit } from '@assistant-ui/react'
import type { ToolSet } from 'ai'
import { jsonSchema, stepCountIs, tool, ToolLoopAgent } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { toToolsJSONSchema } from 'assistant-stream'

interface AgentOptions {
  baseURL: string
  apiKey: string
  model: string
  system?: string
  toolkit: Toolkit
}

const MAX_STEPS = 12

function buildToolSet(toolkit: Toolkit): ToolSet {
  const schemas = toToolsJSONSchema(toolkit as never)
  const out: ToolSet = {}
  for (const [name, schema] of Object.entries(schemas)) {
    const original = (toolkit as Record<string, { execute?: (args: unknown) => unknown }>)[name]
    out[name] = tool({
      description: schema.description,
      inputSchema: jsonSchema(schema.parameters as Parameters<typeof jsonSchema>[0]),
      execute: original?.execute as never,
    })
  }
  return out
}

export function createTourAgent({ baseURL, apiKey, model, system, toolkit }: AgentOptions) {
  const provider = createOpenAICompatible({ name: 'tour-llm', baseURL, apiKey })
  return new ToolLoopAgent({
    model: provider(model),
    tools: buildToolSet(toolkit),
    instructions: system,
    stopWhen: stepCountIs(MAX_STEPS),
  })
}
