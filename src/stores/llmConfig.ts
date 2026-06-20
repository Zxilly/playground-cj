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

export interface AutoQuotaState {
  readonly nextResetAt: number
  readonly exhausted: boolean
  /**
   * The shared per-IP allowance granted each reset period (quota units). Lets the
   * settings dialog show today's usage against today's budget instead of the
   * token's cumulative lifetime total. Optional: absent for older cached keys.
   */
  readonly perPeriod?: number
}

interface LLMConfigState {
  readonly config: Readonly<LLMConfig>
  readonly keySource: LLMKeySource
  readonly autoQuota: AutoQuotaState | null
  readonly settingsDialogOpen: boolean
  readonly setConfig: (next: LLMConfig) => void
  readonly setSharedConfig: () => void
  readonly applyAutoKey: (next: Partial<LLMConfig> & { apiKey: string }) => void
  readonly setAutoQuota: (next: AutoQuotaState | null) => void
  readonly setSettingsDialogOpen: (open: boolean) => void
  readonly reset: () => void
}

export const useLLMConfigStore = create<LLMConfigState>()(
  persist(
    set => ({
      config: DEFAULT_LLM_CONFIG,
      keySource: 'auto',
      autoQuota: null,
      settingsDialogOpen: false,
      setConfig: next => set({ config: normaliseLLMConfig(next), keySource: 'user', autoQuota: null }),
      setSharedConfig: () => set({
        config: normaliseLLMConfig(DEFAULT_LLM_CONFIG),
        keySource: 'auto',
        autoQuota: null,
      }),
      applyAutoKey: next =>
        set((state) => {
          if (state.keySource !== 'auto')
            return state
          return {
            config: normaliseLLMConfig({ ...state.config, ...next }),
          }
        }),
      setAutoQuota: next => set({ autoQuota: next }),
      setSettingsDialogOpen: open => set({ settingsDialogOpen: open }),
      reset: () => set({ config: DEFAULT_LLM_CONFIG, keySource: 'auto', autoQuota: null }),
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

export function useAutoQuota(): AutoQuotaState | null {
  return useLLMConfigStore(state => state.autoQuota)
}
