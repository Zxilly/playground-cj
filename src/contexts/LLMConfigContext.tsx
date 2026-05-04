/* eslint-disable react-refresh/only-export-components */
'use client'

import { createContext, use, useCallback, useMemo, useState } from 'react'
import { readJSON, removeKey, writeJSON } from '@/lib/storage'

export interface LLMConfig {
  baseURL: string
  apiKey: string
  model: string
}

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  baseURL: 'https://cj-api.learningman.top/llm/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
}

interface LLMConfigContextValue {
  config: LLMConfig
  setConfig: (next: LLMConfig) => void
  reset: () => void
}

const LLMConfigContext = createContext<LLMConfigContextValue | null>(null)

const STORAGE_KEY = 'tour-ai:config'

function readInitial(): LLMConfig {
  const parsed = readJSON<Partial<LLMConfig> | null>(STORAGE_KEY, null)
  if (!parsed)
    return DEFAULT_LLM_CONFIG
  return {
    baseURL: parsed.baseURL || DEFAULT_LLM_CONFIG.baseURL,
    apiKey: parsed.apiKey ?? '',
    model: parsed.model || DEFAULT_LLM_CONFIG.model,
  }
}

export function LLMConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<LLMConfig>(readInitial)

  const setConfigAndPersist = useCallback((next: LLMConfig) => {
    writeJSON(STORAGE_KEY, next)
    setConfig(next)
  }, [])

  const reset = useCallback(() => {
    removeKey(STORAGE_KEY)
    setConfig(DEFAULT_LLM_CONFIG)
  }, [])

  const value = useMemo<LLMConfigContextValue>(
    () => ({ config, setConfig: setConfigAndPersist, reset }),
    [config, setConfigAndPersist, reset],
  )

  return (
    <LLMConfigContext value={value}>
      {children}
    </LLMConfigContext>
  )
}

export function useLLMConfig(): LLMConfigContextValue {
  const ctx = use(LLMConfigContext)
  if (!ctx)
    throw new Error('useLLMConfig must be used within <LLMConfigProvider>')
  return ctx
}
