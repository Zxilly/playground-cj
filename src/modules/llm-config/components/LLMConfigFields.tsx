'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { CheckCircle2, CircleAlert, KeyRound, Loader2, PlugZap } from 'lucide-react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { LLMConfig, LLMConnectionTestResult, LLMProvider } from '@/lib/ai/model-provider'
import {
  applyProviderPreset,
  detectProviderPreset,
  isLLMConfigReady,
  isValidLLMBaseURL,
  LLM_PROVIDER_PRESETS,
  providerLabel,
  switchProvider,
  testLLMConnection,
} from '@/lib/ai/model-provider'

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
 * The custom-provider configuration fields (quick presets, API style, service
 * address, API Key, model, connection test) plus the incomplete-config alert.
 * Controlled and presentation only — it owns no save/enter logic, so both the
 * settings dialog and the onboarding wizard render it and apply the draft
 * however they need.
 */
export function LLMConfigFields({ value, onChange, apiKeyDescribedBy, apiKeyPlaceholder, validationId }: LLMConfigFieldsProps) {
  const { t } = useLingui()
  const presetGroupLabelId = useId()
  const providerGroupLabelId = useId()
  const apiKeyStorageHelpId = useId()
  const missingEndpoint = value.baseURL.trim().length === 0
  const invalidEndpoint = !missingEndpoint && !isValidLLMBaseURL(value.baseURL)
  const missingModel = value.model.trim().length === 0
  const invalidConfig = missingEndpoint || invalidEndpoint || missingModel
  const activePreset = detectProviderPreset(value)
  const canTestConnection = isLLMConfigReady(value)

  const configSignature = `${value.provider}\0${value.baseURL}\0${value.apiKey}\0${value.model}`
  const [testState, setTestState] = useState<{
    signature: string
    status: 'testing' | 'done'
    result?: LLMConnectionTestResult
  } | null>(null)
  const testAbortRef = useRef<AbortController | null>(null)

  useEffect(() => () => {
    testAbortRef.current?.abort()
  }, [])

  const visibleTestState = testState?.signature === configSignature ? testState : null
  const testing = visibleTestState?.status === 'testing'
  const testResult = visibleTestState?.status === 'done' ? visibleTestState.result : undefined
  const latencyMs = testResult?.ok ? testResult.latencyMs : undefined
  const httpErrorStatus = testResult && !testResult.ok ? testResult.status : undefined

  const handleTestConnection = async () => {
    if (!canTestConnection || testing)
      return
    testAbortRef.current?.abort()
    const controller = new AbortController()
    testAbortRef.current = controller
    const snapshotSignature = configSignature
    setTestState({ signature: snapshotSignature, status: 'testing' })
    try {
      const result = await testLLMConnection(value, controller.signal)
      if (!controller.signal.aborted)
        setTestState({ signature: snapshotSignature, status: 'done', result })
    }
    catch {
      if (!controller.signal.aborted) {
        setTestState({
          signature: snapshotSignature,
          status: 'done',
          result: { ok: false, kind: 'network' },
        })
      }
    }
  }

  return (
    <>
      <div className="grid gap-1.5">
        <div id={presetGroupLabelId} className="text-xs font-medium"><Trans>官方服务商快捷预设</Trans></div>
        <div role="group" aria-labelledby={presetGroupLabelId} className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {LLM_PROVIDER_PRESETS.map(preset => (
            <Button
              key={preset.id}
              type="button"
              variant={activePreset === preset.id ? 'secondary' : 'outline'}
              size="sm"
              aria-pressed={activePreset === preset.id}
              onClick={() => onChange(applyProviderPreset(value, preset.id))}
              className="min-h-11 min-w-0 cursor-pointer px-2 text-xs whitespace-normal break-words lg:min-h-8"
            >
              {preset.label ?? <Trans>自定义</Trans>}
            </Button>
          ))}
        </div>
      </div>

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
          aria-describedby={[apiKeyDescribedBy, apiKeyStorageHelpId].filter(Boolean).join(' ')}
          onChange={e => onChange({ ...value, apiKey: e.target.value })}
          placeholder={apiKeyPlaceholder}
          className="font-mono text-xs"
        />
        <p id={apiKeyStorageHelpId} className="text-xs leading-5 text-muted-foreground">
          <Trans>API Key 会保存在当前浏览器。请仅在受信设备上使用；在 AI 服务设置中切换到共享额度并保存，可将它从本机删除。</Trans>
        </p>
      </div>
      <div className="grid gap-1.5">
        <div id={providerGroupLabelId} className="text-xs font-medium"><Trans>API 风格</Trans></div>
        <div role="group" aria-labelledby={providerGroupLabelId} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PROVIDERS.map(provider => (
            <Button
              key={provider}
              type="button"
              variant={value.provider === provider ? 'default' : 'outline'}
              size="sm"
              aria-pressed={value.provider === provider}
              onClick={() => onChange(switchProvider(value, provider))}
              className="min-h-11 min-w-0 cursor-pointer whitespace-normal break-words lg:min-h-8"
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
          aria-invalid={missingEndpoint || invalidEndpoint || undefined}
          aria-describedby={missingEndpoint || invalidEndpoint ? validationId : undefined}
          onChange={e => onChange({ ...value, baseURL: e.target.value })}
          placeholder="https://api.openai.com/v1"
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
          placeholder={t`例如：gpt-4o-mini / deepseek-chat`}
          className="font-mono text-xs"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="llm-test-connection"
          disabled={!canTestConnection || testing}
          onClick={() => void handleTestConnection()}
          className="min-h-11 cursor-pointer lg:min-h-8"
        >
          {testing
            ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin motion-reduce:animate-none" />
            : <PlugZap aria-hidden="true" className="size-3.5" />}
          {testing ? <Trans>正在测试连接…</Trans> : <Trans>测试连接</Trans>}
        </Button>
        {testResult && (
          testResult.ok
            ? (
                <p
                  role="status"
                  data-testid="llm-test-connection-result"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"
                >
                  <CheckCircle2 aria-hidden="true" className="size-3.5 shrink-0" />
                  <Trans>
                    连接成功（
                    {latencyMs}
                    {' '}
                    ms）
                  </Trans>
                </p>
              )
            : (
                <p
                  role="status"
                  data-testid="llm-test-connection-result"
                  className="inline-flex items-center gap-1.5 text-xs text-error-foreground"
                >
                  <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
                  <span>
                    {testResult.kind === 'auth'
                      ? <Trans>认证失败（401/403）：请检查 API Key 是否有效或具备权限。</Trans>
                      : testResult.kind === 'not_found'
                        ? <Trans>接口或模型不存在（404）：请检查服务地址与模型名称。</Trans>
                        : testResult.kind === 'rate_limit'
                          ? <Trans>服务已连通，但当前触发限流或额度不足（429）。</Trans>
                          : testResult.kind === 'timeout'
                            ? <Trans>连接超时，请检查网络或服务地址后重试。</Trans>
                            : testResult.kind === 'http_error'
                              ? (
                                  <Trans>
                                    服务返回异常状态（HTTP
                                    {' '}
                                    {httpErrorStatus}
                                    ）。
                                  </Trans>
                                )
                              : <Trans>无法连接到目标服务，请检查地址、网络或跨域（CORS）设置。</Trans>}
                  </span>
                </p>
              )
        )}
      </div>

      {invalidConfig && (
        <p id={validationId} role="alert" className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
          <span>
            {invalidEndpoint
              ? <Trans>请输入以 http:// 或 https:// 开头的有效服务地址。</Trans>
              : <Trans>使用自定义 API Key 时，需同时配置服务地址与模型。</Trans>}
          </span>
        </p>
      )}
    </>
  )
}
