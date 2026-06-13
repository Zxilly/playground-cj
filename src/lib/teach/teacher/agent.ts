import type { ToolSet } from 'ai'
import type { LLMConfig } from '@/lib/ai/model-provider'
import type { TeacherLang } from './system-prompt'
import { ToolLoopAgent } from 'ai'
import { createConfiguredModel } from '@/lib/ai/model-provider'
import { buildTeacherSystemPrompt } from './system-prompt'

/** The teacher agent type, parameterised by its concrete tool set. */
export type TeacherAgent<TOOLS extends ToolSet = ToolSet> = ToolLoopAgent<never, TOOLS>

/**
 * Assemble the single Cangjie Teacher agent.
 *
 * Reuses {@link createConfiguredModel} (the shared LLM provider factory backed
 * by the user's `llmConfig`) for the language model, wires the language-specific
 * system prompt (see {@link buildTeacherSystemPrompt}) as the agent's
 * `instructions`, and runs the supplied toolkit in an AI SDK v6
 * {@link ToolLoopAgent} loop. Browser-only: no server AI route is involved.
 *
 * @param config The resolved LLM configuration (provider / baseURL / key / model).
 * @param toolkit The teacher tool set (see `createTeacherToolkit`).
 * @param lang UI language for the system prompt and lesson authoring.
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
  })
}
