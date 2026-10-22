import type { ToolSet } from 'ai'
import type { LLMConfig } from '@/lib/ai/model-provider'
import type { TeacherLang } from './system-prompt'
import { hasToolCall, isStepCount, ToolLoopAgent } from 'ai'
import { createConfiguredModel } from '@/lib/ai/model-provider'
import {
  buildRemediationSystemPrompt,
  buildTeacherSystemPrompt,
} from './system-prompt'

/** The teacher agent type, parameterised by its concrete tool set. */
export type TeacherAgent = ToolLoopAgent<never, ToolSet>

/**
 * Assemble the single Cangjie Lesson Orchestrator.
 *
 * Reuses {@link createConfiguredModel} (the shared LLM provider factory backed
 * by the user's `llmConfig`) for the language model, wires the language-specific
 * system prompt (see {@link buildTeacherSystemPrompt}) as the agent's
 * `instructions`, and runs the supplied capability-limited toolkit in an AI SDK
 * {@link ToolLoopAgent} loop.
 *
 * @param config The resolved LLM configuration (provider / baseURL / key / model).
 * @param toolkit The Lesson Orchestrator tool set.
 * @param lang UI language for the system prompt.
 */
export function createTeacherAgent(
  config: Partial<LLMConfig>,
  toolkit: ToolSet,
  lang: TeacherLang,
): TeacherAgent {
  return new ToolLoopAgent<never, ToolSet>({
    model: createConfiguredModel(config),
    instructions: buildTeacherSystemPrompt(lang),
    tools: toolkit,
    stopWhen: isStepCount(8),
  })
}

/**
 * Assemble the capability-limited background worker that completes one pending
 * Remediation. It has separate instructions from the learner-facing Lesson
 * Orchestrator and a hard three-step ceiling; a successful retention tool call
 * ends the loop immediately.
 */
export function createRemediationAgent(
  config: Partial<LLMConfig>,
  toolkit: ToolSet,
  lang: TeacherLang,
): TeacherAgent {
  return new ToolLoopAgent<never, ToolSet>({
    model: createConfiguredModel(config),
    instructions: buildRemediationSystemPrompt(lang),
    tools: toolkit,
    stopWhen: [
      hasToolCall('retain_remediation'),
      isStepCount(3),
    ],
  })
}
