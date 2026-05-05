import type { Toolkit } from '@assistant-ui/react'
import type { JSONSchema7, ToolSet } from 'ai'
import { jsonSchema, tool } from 'ai'

function isStandardSchema(value: unknown): boolean {
  return typeof value === 'object' && value !== null && '~standard' in value
}

export function toolkitToToolSet(toolkit: Toolkit): ToolSet {
  const out: ToolSet = {}
  for (const [name, entry] of Object.entries(toolkit)) {
    if (entry.type === 'backend' || entry.disabled)
      continue
    const inputSchema = isStandardSchema(entry.parameters)
      ? entry.parameters
      : jsonSchema(entry.parameters as JSONSchema7)
    out[name] = tool({
      description: entry.description,
      inputSchema: inputSchema as never,
      execute: entry.execute as never,
    })
  }
  return out
}
