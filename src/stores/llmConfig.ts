'use client'

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {

  normaliseLLMConfig,
  resolveProviderDefaults,
} from '@/lib/ai/model-provider'
import type { LLMConfig } from '@/lib/ai/model-provider'

export type LLMKeySource = 'auto' | 'user'
export type { LLMConfig } from '@/lib/ai/model-provider'

export const DEFAULT_LLM_CONFIG: LLMConfig = resolveProviderDefaults('openai-compatible')

interface LLMConfigState {
  readonly config: Readonly<LLMConfig>
  readonly keySource: LLMKeySource
  readonly setConfig: (next: LLMConfig) => void
  readonly applyAutoKey: (next: Partial<LLMConfig> & { apiKey: string }) => void
  readonly reset: () => void
}

export const useLLMConfigStore = create<LLMConfigState>()(
  persist(
    set => ({
      config: DEFAULT_LLM_CONFIG,
      keySource: 'auto',
      setConfig: next => set({ config: normaliseLLMConfig(next), keySource: 'user' }),
      applyAutoKey: next =>
        set((state) => {
          if (state.keySource !== 'auto')
            return state
          return {
            config: normaliseLLMConfig({ ...state.config, ...next }),
          }
        }),
      reset: () => set({ config: DEFAULT_LLM_CONFIG, keySource: 'auto' }),
    }),
    {
      name: 'tour-ai:config',
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({ config: state.config, keySource: state.keySource }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<LLMConfigState>
        return {
          ...current,
          ...saved,
          config: normaliseLLMConfig(saved.config ?? current.config),
        }
      },
    },
  ),
)

export function useLLMConfig(): LLMConfig {
  return useLLMConfigStore(state => state.config)
}

export function useLLMKeySource(): LLMKeySource {
  return useLLMConfigStore(state => state.keySource)
}
