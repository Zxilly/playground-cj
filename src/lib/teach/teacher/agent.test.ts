import type { ToolSet } from 'ai'
import { describe, expect, it, vi } from 'vitest'

const createConfiguredModel = vi.fn((..._args: unknown[]) => ({ modelId: 'fake-model' }))

vi.mock('@/lib/ai/model-provider', () => ({
  createConfiguredModel: (...args: unknown[]) => createConfiguredModel(...args),
}))

const { createTeacherAgent } = await import('./agent')
const { buildTeacherSystemPrompt } = await import('./system-prompt')

const config = { provider: 'anthropic' as const, baseURL: 'b', apiKey: 'k', model: 'm' }

function fakeToolkit(): ToolSet {
  return {
    read_mission: {
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
})
