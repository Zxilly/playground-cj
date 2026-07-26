'use client'

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  normaliseLLMConfig,
  resolveSharedGatewayConfig,
} from '@/lib/ai/model-provider'
import type { LLMConfig } from '@/lib/ai/model-provider'

export type LLMKeySource = 'auto' | 'user'
export type { LLMConfig } from '@/lib/ai/model-provider'

export const DEFAULT_LLM_CONFIG: LLMConfig = resolveSharedGatewayConfig()

export interface AutoQuotaState {
  readonly nextResetAt: number
  readonly exhausted: boolean
  /** Allowance granted to this trusted quota bucket for the current period. */
  readonly perPeriod: number
  /** Remaining quota reported by the server-side gateway. */
  readonly available: number
}

interface LLMConfigState {
  readonly config: Readonly<LLMConfig>
  readonly keySource: LLMKeySource
  readonly autoQuota: AutoQuotaState | null
  readonly settingsDialogOpen: boolean
  readonly setConfig: (next: LLMConfig) => void
  readonly setSharedConfig: () => void
  readonly applyAutoConfig: (next: { model: string }) => void
  readonly setAutoQuota: (next: AutoQuotaState | null) => void
  readonly setSettingsDialogOpen: (open: boolean) => void
  readonly reset: () => void
}

interface PersistedLLMConfig {
  readonly keySource?: LLMKeySource
  readonly config?: Partial<LLMConfig>
}

export function sanitizePersistedLLMConfig(saved: PersistedLLMConfig): LLMConfig {
  if (saved.keySource !== 'user')
    return resolveSharedGatewayConfig(saved.config?.model)
  return normaliseLLMConfig({
    ...saved.config,
    transport: 'direct',
  })
}

export const useLLMConfigStore = create<LLMConfigState>()(
  persist(
    set => ({
      config: DEFAULT_LLM_CONFIG,
      keySource: 'auto',
      autoQuota: null,
      settingsDialogOpen: false,
      setConfig: next => set({
        config: normaliseLLMConfig({ ...next, transport: 'direct' }),
        keySource: 'user',
        autoQuota: null,
      }),
      setSharedConfig: () => set({
        config: resolveSharedGatewayConfig(),
        keySource: 'auto',
        autoQuota: null,
      }),
      applyAutoConfig: next =>
        set((state) => {
          if (state.keySource !== 'auto')
            return state
          return {
            config: resolveSharedGatewayConfig(next.model),
          }
        }),
      setAutoQuota: next => set({ autoQuota: next }),
      setSettingsDialogOpen: open => set({ settingsDialogOpen: open }),
      reset: () => set({ config: DEFAULT_LLM_CONFIG, keySource: 'auto', autoQuota: null }),
    }),
    {
      name: 'tour-ai:config',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({ config: state.config, keySource: state.keySource }),
      migrate: (persisted) => {
        const saved = persisted as PersistedLLMConfig
        const keySource = saved.keySource === 'user' ? 'user' : 'auto'
        return {
          ...saved,
          keySource,
          config: sanitizePersistedLLMConfig({
            keySource,
            config: saved.config,
          }),
        }
      },
      merge: (persisted, current) => {
        const saved = persisted as Partial<LLMConfigState>
        const keySource = saved.keySource === 'user' ? 'user' : 'auto'
        return {
          ...current,
          ...saved,
          keySource,
          config: sanitizePersistedLLMConfig({
            keySource,
            config: saved.config,
          }),
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
