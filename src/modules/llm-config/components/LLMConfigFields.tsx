'use client'

import { useId } from 'react'
import { CircleAlert, KeyRound } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { LLMConfig, LLMProvider } from '@/lib/ai/model-provider'
import { providerLabel, switchProviderPreservingKey } from '@/lib/ai/model-provider'

const PROVIDERS = ['openai-compatible', 'anthropic'] satisfies LLMProvider[]

export interface LLMConfigFieldsProps {
  /** The editable config draft. */
  value: LLMConfig
  /** Called with the next draft on any field change. */
  onChange: (next: LLMConfig) => void
  /**
   * Id of an external element describing the API Key input (e.g. the dialog's
   * mode-help line). Optional.
   */
  apiKeyDescribedBy?: string
  /** Placeholder for the API Key input — differs by context. */
  apiKeyPlaceholder: string
  /**
   * Parent-owned id for the "needs address + model" alert. Shared so the
   * parent's submit button can also point its `aria-describedby` at it.
   */
  validationId: string
}

/**
 * The custom-provider configuration fields (API style, service address, API
 * Key, model) plus the incomplete-config alert. Controlled and presentation
 * only — it owns no save/enter logic, so both the settings dialog and the
 * onboarding wizard render it and apply the draft however they need.
 */
export function LLMConfigFields({ value, onChange, apiKeyDescribedBy, apiKeyPlaceholder, validationId }: LLMConfigFieldsProps) {
  const providerGroupLabelId = useId()
  const missingEndpoint = value.baseURL.trim().length === 0
  const missingModel = value.model.trim().length === 0

  return (
    <>
      <div className="grid gap-1.5">
        <Label htmlFor="llm-api-key" className="flex items-center gap-1 text-xs font-medium">
          <KeyRound aria-hidden="true" className="size-3" />
          <Trans>API Key</Trans>
        </Label>
        <Input
          id="llm-api-key"
          type="password"
          autoComplete="off"
          value={value.apiKey}
          aria-describedby={apiKeyDescribedBy}
          onChange={e => onChange({ ...value, apiKey: e.target.value })}
          placeholder={apiKeyPlaceholder}
          className="font-mono text-xs"
        />
      </div>
      <div className="grid gap-1.5">
        <div id={providerGroupLabelId} className="text-xs font-medium"><Trans>API 风格</Trans></div>
        <div role="group" aria-labelledby={providerGroupLabelId} className="grid grid-cols-2 gap-2">
          {PROVIDERS.map(provider => (
            <Button
              key={provider}
              type="button"
              variant={value.provider === provider ? 'default' : 'outline'}
              size="sm"
              aria-pressed={value.provider === provider}
              onClick={() => onChange(switchProviderPreservingKey(value, provider))}
              className="cursor-pointer"
            >
              {providerLabel(provider)}
            </Button>
          ))}
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="llm-base-url" className="text-xs font-medium"><Trans>服务地址</Trans></Label>
        <Input
          id="llm-base-url"
          value={value.baseURL}
          aria-invalid={missingEndpoint || undefined}
          aria-describedby={missingEndpoint ? validationId : undefined}
          onChange={e => onChange({ ...value, baseURL: e.target.value })}
          placeholder="https://..."
          className="font-mono text-xs"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="llm-model" className="text-xs font-medium"><Trans>模型</Trans></Label>
        <Input
          id="llm-model"
          value={value.model}
          aria-invalid={missingModel || undefined}
          aria-describedby={missingModel ? validationId : undefined}
          onChange={e => onChange({ ...value, model: e.target.value })}
          placeholder="model"
          className="font-mono text-xs"
        />
      </div>

      {(missingEndpoint || missingModel) && (
        <p id={validationId} role="alert" className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
          <span><Trans>使用自定义 API Key 时，需同时配置服务地址与模型。</Trans></span>
        </p>
      )}
    </>
  )
}
