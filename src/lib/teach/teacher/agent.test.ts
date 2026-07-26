import type { ToolCallOptions, ToolSet } from 'ai'
import { tool } from 'ai'
import { MockLanguageModelV3 } from 'ai/test'
import { z } from 'zod'
import { describe, expect, it, vi } from 'vitest'
import { createTeacherToolCallBudget } from './toolkit'

const createConfiguredModel = vi.fn((..._args: unknown[]) => ({ modelId: 'fake-model' }))

vi.mock('@/lib/ai/model-provider', () => ({
  createConfiguredModel: (...args: unknown[]) => createConfiguredModel(...args),
}))

const { createRemediationAgent, createTeacherAgent } = await import('./agent')
const {
  buildRemediationSystemPrompt,
  buildTeacherSystemPrompt,
} = await import('./system-prompt')

const config = { provider: 'anthropic' as const, baseURL: 'b', apiKey: 'k', model: 'm' }
const usage = {
  inputTokens: {
    total: 1,
    noCache: 1,
    cacheRead: 0,
    cacheWrite: 0,
  },
  outputTokens: {
    total: 1,
    text: 1,
    reasoning: 0,
  },
}

function fakeToolkit(): ToolSet {
  return {
    read_classroom_state: {
      description: 'd',
      inputSchema: { jsonSchema: { type: 'object' } } as never,
      execute: async () => ({ ok: true }),
    },
  } as unknown as ToolSet
}

describe('createTeacherAgent', () => {
  it('returns a ToolLoopAgent carrying the toolkit', () => {
    const toolkit = fakeToolkit()
    const agent = createTeacherAgent(config, toolkit, 'zh')
    expect(agent.version).toBe('agent-v1')
    expect(typeof agent.generate).toBe('function')
    expect(typeof agent.stream).toBe('function')
    expect(agent.tools).toBe(toolkit)
  })

  it('builds the model from the injected LLM config via model-provider', () => {
    createConfiguredModel.mockClear()
    createTeacherAgent(config, fakeToolkit(), 'en')
    expect(createConfiguredModel).toHaveBeenCalledTimes(1)
    expect(createConfiguredModel).toHaveBeenCalledWith(config)
  })

  it('wires the language-specific system prompt as instructions', () => {
    const zh = createTeacherAgent(config, fakeToolkit(), 'zh')
    // The agent's settings are private; assert the prompt is the one we expect
    // by reading the instructions off the constructed settings.
    const settings = (zh as unknown as { settings: { instructions?: unknown } }).settings
    expect(settings.instructions).toBe(buildTeacherSystemPrompt('zh'))

    const en = createTeacherAgent(config, fakeToolkit(), 'en')
    const enSettings = (en as unknown as { settings: { instructions?: unknown } }).settings
    expect(enSettings.instructions).toBe(buildTeacherSystemPrompt('en'))
  })

  it('bounds the learner-facing orchestrator tool loop', async () => {
    const agent = createTeacherAgent(config, fakeToolkit(), 'en')
    const settings = (agent as unknown as {
      settings: {
        stopWhen?: (
          (input: { steps: unknown[] }) => boolean | PromiseLike<boolean>
        ) | Array<(input: { steps: unknown[] }) => boolean | PromiseLike<boolean>>
      }
    }).settings
    expect(typeof settings.stopWhen).toBe('function')
    const shouldStop = settings.stopWhen as Exclude<
      typeof settings.stopWhen,
      undefined | unknown[]
    >
    await expect(Promise.resolve(shouldStop({
      steps: Array.from({ length: 7 }, () => ({ toolCalls: [] })),
    }))).resolves.toBe(false)
    await expect(Promise.resolve(shouldStop({
      steps: Array.from({ length: 8 }, () => ({ toolCalls: [] })),
    }))).resolves.toBe(true)
  })

  it('bounds the dedicated Remediation worker and stops after retention', async () => {
    const agent = createRemediationAgent(config, fakeToolkit(), 'en')
    const settings = (agent as unknown as {
      settings: {
        instructions?: unknown
        stopWhen?: Array<(input: { steps: unknown[] }) => boolean | PromiseLike<boolean>>
      }
    }).settings
    expect(settings.instructions).toBe(buildRemediationSystemPrompt('en'))
    expect(settings.stopWhen).toHaveLength(2)

    const shouldStop = async (steps: unknown[]) => {
      const decisions = await Promise.all(
        settings.stopWhen!.map(condition => condition({ steps })),
      )
      return decisions.some(Boolean)
    }
    await expect(shouldStop([{
      toolCalls: [{ toolName: 'retain_remediation' }],
    }])).resolves.toBe(true)
    await expect(shouldStop([
      { toolCalls: [] },
      { toolCalls: [] },
    ])).resolves.toBe(false)
    await expect(shouldStop([
      { toolCalls: [] },
      { toolCalls: [] },
      { toolCalls: [] },
    ])).resolves.toBe(true)
  })

  it('preserves an explicitly composed timeout signal through real tool execution', async () => {
    const model = new MockLanguageModelV3({
      // The SDK test double indexes scripted values by its 1-based call count.
      doGenerate: [
        {
          content: [{
            type: 'tool-call',
            toolCallId: 'call:read',
            toolName: 'read_assigned_remediation_context',
            input: '{}',
          }],
          finishReason: { unified: 'tool-calls', raw: undefined },
          usage,
          warnings: [],
        },
        {
          content: [{
            type: 'tool-call',
            toolCallId: 'call:read',
            toolName: 'read_assigned_remediation_context',
            input: '{}',
          }],
          finishReason: { unified: 'tool-calls', raw: undefined },
          usage,
          warnings: [],
        },
        {
          content: [{ type: 'text', text: 'Diagnosis complete.' }],
          finishReason: { unified: 'stop', raw: undefined },
          usage,
          warnings: [],
        },
      ],
    })
    createConfiguredModel.mockReturnValueOnce(model)
    const budget = createTeacherToolCallBudget()
    const caller = new AbortController()
    const operationSignal = AbortSignal.any([
      caller.signal,
      AbortSignal.timeout(30_000),
    ])
    const lease = budget.open(operationSignal, {
      total: 1,
      documentationSearches: 0,
    })
    const execute = vi.fn((_input: object, options: ToolCallOptions) => ({
      ok: budget.consume(options, 'general') === null,
      sameSignal: options.abortSignal === operationSignal,
    }))
    const agent = createRemediationAgent(config, {
      read_assigned_remediation_context: tool({
        description: 'Read state once.',
        inputSchema: z.object({}).strict(),
        execute,
      }),
    }, 'en')

    let result: Awaited<ReturnType<typeof agent.generate>>
    try {
      result = await agent.generate({
        prompt: 'Diagnose the assigned attempt.',
        abortSignal: operationSignal,
      })
    }
    finally {
      lease.close()
    }

    expect(result.steps[0]?.toolCalls).toHaveLength(1)
    expect(execute).toHaveBeenCalledOnce()
    expect(execute.mock.results[0]?.value).toEqual({
      ok: true,
      sameSignal: true,
    })
    expect(lease.remaining().total).toBe(0)
  })
})
