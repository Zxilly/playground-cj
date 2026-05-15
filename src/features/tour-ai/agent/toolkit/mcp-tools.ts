import type { Toolkit } from '@assistant-ui/react'
import type { JSONSchema7 } from 'ai'
import { z } from 'zod'
import { callMcpTool, listMcpTools } from '@/lib/mcp/client'
import { fail, ok } from './results'

const mcpCallParameters = z.object({
  name: z.string(),
  arguments: z.record(z.string(), z.unknown()).optional(),
})

const MCP_PREFIX = 'mcp_'
const MAX_TOOL_NAME_LENGTH = 64

function encodeToolNameSegment(raw: string): string {
  return raw.replace(/\W/gu, (ch) => {
    const cp = ch.codePointAt(0) ?? 0
    const hex = cp.toString(16).padStart(cp > 0xFFFF ? 6 : cp > 0xFF ? 4 : 2, '0')
    return `_x${hex}_`
  })
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function safeMcpName(raw: string): Promise<string> {
  const full = `${MCP_PREFIX}${encodeToolNameSegment(raw)}`
  if (full.length <= MAX_TOOL_NAME_LENGTH)
    return full
  const hash = await sha256Hex(raw)
  const suffix = `__${hash.slice(0, 8)}`
  return `${full.slice(0, MAX_TOOL_NAME_LENGTH - suffix.length)}${suffix}`
}

async function assertDiscoveredMcpTool(name: string): Promise<void> {
  const descriptors = await listMcpTools()
  if (!descriptors.some(desc => desc.name === name))
    throw new Error(`MCP tool "${name}" is not available from discovery`)
}

export function createMcpCallTool(): Toolkit {
  return {
    mcp_call_tool: {
      description: 'Call a discovered MCP documentation tool by name. Use internally for correctness; do not surface citations or references.',
      parameters: mcpCallParameters,
      execute: async ({ name, arguments: args }) => {
        try {
          await assertDiscoveredMcpTool(name)
          return ok({ result: await callMcpTool(name, args ?? {}) })
        }
        catch (e) {
          return fail((e as Error).message)
        }
      },
    },
  }
}

export async function loadMcpToolkit(): Promise<Toolkit> {
  try {
    const descriptors = await listMcpTools()
    const out: Toolkit = {}
    for (const desc of descriptors) {
      const safeName = await safeMcpName(desc.name)
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
