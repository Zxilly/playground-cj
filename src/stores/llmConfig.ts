'use client'

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type LLMKeySource = 'auto' | 'user'

export interface LLMConfig {
  baseURL: string
  apiKey: string
  model: string
}

const PUBLIC_LLM_BASE_URL = process.env.NEXT_PUBLIC_LLM_BASE_URL || 'https://llm.learningman.top/v1'
const DEFAULT_MODEL = process.env.NEXT_PUBLIC_LLM_DEFAULT_MODEL || 'gpt-4o-mini'

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  baseURL: PUBLIC_LLM_BASE_URL,
  apiKey: '',
  model: DEFAULT_MODEL,
}

interface LLMConfigState {
  readonly config: Readonly<LLMConfig>
  readonly keySource: LLMKeySource
  readonly setConfig: (next: LLMConfig) => void
  readonly applyAutoKey: (next: { baseURL?: string, apiKey: string, model?: string }) => void
  readonly reset: () => void
}

export const useLLMConfigStore = create<LLMConfigState>()(
  persist(
    set => ({
      config: DEFAULT_LLM_CONFIG,
      keySource: 'auto',
      setConfig: next => set({ config: next, keySource: 'user' }),
      applyAutoKey: ({ baseURL, apiKey, model }) =>
        set((state) => {
          if (state.keySource !== 'auto')
            return state
          return {
            config: {
              baseURL: baseURL ?? state.config.baseURL,
              apiKey,
              model: model ?? state.config.model,
            },
          }
        }),
      reset: () => set({ config: DEFAULT_LLM_CONFIG, keySource: 'auto' }),
    }),
    {
      name: 'tour-ai:config',
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({ config: state.config, keySource: state.keySource }),
    },
  ),
)

export function useLLMConfig(): LLMConfig {
  return useLLMConfigStore(state => state.config)
}

export function useLLMKeySource(): LLMKeySource {
  return useLLMConfigStore(state => state.keySource)
}
