'use client'

import type { Toolkit } from '@assistant-ui/react'
import type { JSONSchema7, ToolSet } from 'ai'
import { jsonSchema, stepCountIs, tool, ToolLoopAgent } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

interface AgentOptions {
  baseURL: string
  apiKey: string
  model: string
  system?: string
  toolkit: Toolkit
}

const MAX_STEPS = 12

function isStandardSchema(value: unknown): boolean {
  return typeof value === 'object' && value !== null && '~standard' in value
}

function buildToolSet(toolkit: Toolkit): ToolSet {
  const out: ToolSet = {}
  for (const [name, t] of Object.entries(toolkit)) {
    if (t.type === 'backend' || t.disabled)
      continue
    // Toolkit.parameters is `StandardSchemaV1 | JSONSchema7`. ai-sdk's
    // asSchema() recognises Standard Schema (Zod v4 has `~standard`) and
    // attaches a validator for free, but a raw JSONSchema7 — what every
    // MCP tool ships — must be wrapped with `jsonSchema()` first or
    // asSchema() falls through to calling it as a function ("schema is
    // not a function").
    const inputSchema = isStandardSchema(t.parameters)
      ? t.parameters
      : jsonSchema(t.parameters as JSONSchema7)
    out[name] = tool({
      description: t.description,
      inputSchema: inputSchema as never,
      execute: t.execute as never,
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
