import type { ToolSet } from 'ai'
import type { LLMConfig } from '@/lib/ai/model-provider'
import type { TeacherLang } from './system-prompt'
import { hasToolCall, stepCountIs, ToolLoopAgent } from 'ai'
import { createConfiguredModel } from '@/lib/ai/model-provider'
import {
  buildRemediationSystemPrompt,
  buildTeacherSystemPrompt,
} from './system-prompt'

/** The teacher agent type, parameterised by its concrete tool set. */
export type TeacherAgent<TOOLS extends ToolSet = ToolSet> = ToolLoopAgent<never, TOOLS>

/**
 * Assemble the single Cangjie Lesson Orchestrator.
 *
 * Reuses {@link createConfiguredModel} (the shared LLM provider factory backed
 * by the user's `llmConfig`) for the language model, wires the language-specific
 * system prompt (see {@link buildTeacherSystemPrompt}) as the agent's
 * `instructions`, and runs the supplied capability-limited toolkit in an AI SDK
 * v6 {@link ToolLoopAgent} loop.
 *
 * @param config The resolved LLM configuration (provider / baseURL / key / model).
 * @param toolkit The Lesson Orchestrator tool set.
 * @param lang UI language for the system prompt.
 */
export function createTeacherAgent<TOOLS extends ToolSet>(
  config: Partial<LLMConfig>,
  toolkit: TOOLS,
  lang: TeacherLang,
): TeacherAgent<TOOLS> {
  return new ToolLoopAgent<never, TOOLS>({
    model: createConfiguredModel(config),
    instructions: buildTeacherSystemPrompt(lang),
    tools: toolkit,
    stopWhen: stepCountIs(8),
  })
}

/**
 * Assemble the capability-limited background worker that completes one pending
 * Remediation. It has separate instructions from the learner-facing Lesson
 * Orchestrator and a hard three-step ceiling; a successful retention tool call
 * ends the loop immediately.
 */
export function createRemediationAgent<TOOLS extends ToolSet>(
  config: Partial<LLMConfig>,
  toolkit: TOOLS,
  lang: TeacherLang,
): TeacherAgent<TOOLS> {
  return new ToolLoopAgent<never, TOOLS>({
    model: createConfiguredModel(config),
    instructions: buildRemediationSystemPrompt(lang),
    tools: toolkit,
    stopWhen: [
      hasToolCall('retain_remediation'),
      stepCountIs(3),
    ],
  })
}
