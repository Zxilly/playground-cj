import { describe, expect, it, vi } from 'vitest'
import { toolkitToToolSet } from './toolkit-to-tool-set'
import type { Toolkit } from '@assistant-ui/react'

describe('toolkitToToolSet', () => {
  it('omits backend and disabled tools while preserving executable frontend tools', async () => {
    const execute = vi.fn(async ({ value }: { value: number }) => value + 1)
    const tools = toolkitToToolSet({
      visible: {
        description: 'Visible tool',
        parameters: {
          type: 'object',
          properties: { value: { type: 'number' } },
          required: ['value'],
        },
        execute,
      },
      backendOnly: {
        type: 'backend',
        description: 'Server only',
        parameters: { type: 'object' },
      },
      disabled: {
        disabled: true,
        description: 'Disabled',
        parameters: { type: 'object' },
      },
    } as unknown as Toolkit)

    expect(Object.keys(tools)).toEqual(['visible'])
    await expect(tools.visible.execute?.({ value: 2 } as never, toolOptions() as never)).resolves.toBe(3)
    expect(execute).toHaveBeenCalledWith({ value: 2 }, expect.any(Object))
  })

  it('accepts standard schemas without wrapping them as json schema', () => {
    const standardSchema = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: vi.fn(),
      },
    }

    const tools = toolkitToToolSet({
      standard: {
        description: 'Standard schema',
        parameters: standardSchema,
        execute: async () => 'ok',
      },
    } as unknown as Toolkit)

    expect(tools.standard.inputSchema).toBe(standardSchema)
  })
})

function toolOptions() {
  return {
    toolCallId: 'tool-call',
    abortSignal: new AbortController().signal,
    messages: [],
    human: async () => undefined,
  }
}
