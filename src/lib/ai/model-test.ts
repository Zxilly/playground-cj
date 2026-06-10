'use client'

import { generateText } from 'ai'
import { t } from '@lingui/core/macro'
import {
  createConfiguredModel,
  normaliseLLMConfig,
  providerLabel,
} from '@/lib/ai/model-provider'
import type { LLMConfig } from '@/lib/ai/model-provider'

export interface LLMTestResult {
  ok: boolean
  title: string
  message: string
  details: Record<string, unknown>
}

export async function testLLMConnection(config: LLMConfig): Promise<LLMTestResult> {
  const startedAt = Date.now()
  const next = normaliseLLMConfig(config)
  const baseDetails = {
    provider: next.provider,
    providerLabel: providerLabel(next.provider),
    baseURL: next.baseURL,
    model: next.model,
    hasApiKey: next.apiKey.length > 0,
    apiKeyPreview: next.apiKey ? `${next.apiKey.slice(0, 4)}...${next.apiKey.slice(-4)}` : '',
  }
  const missing = [
    !next.baseURL && t`服务地址`,
    !next.apiKey && 'API Key',
    !next.model && t`模型`,
  ].filter(Boolean)
  const currentProviderLabel = providerLabel(next.provider)
  const missingText = missing.join('、')

  if (missing.length > 0) {
    return {
      ok: false,
      title: t`配置不完整`,
      message: t`请先填写 ${missingText}，再测试 ${currentProviderLabel} 连接。`,
      details: {
        ...baseDetails,
        missing,
        durationMs: Date.now() - startedAt,
      },
    }
  }

  try {
    const result = await generateText({
      model: createConfiguredModel(next, 'tour-llm-test'),
      prompt: 'Reply with OK.',
      maxOutputTokens: 8,
    })
    const text = result.text.trim()
    return {
      ok: true,
      title: t`测试成功`,
      message: text ? t`模型返回：${text}` : t`${currentProviderLabel} 连接正常。`,
      details: {
        ...baseDetails,
        durationMs: Date.now() - startedAt,
        responseText: text,
        finishReason: result.finishReason,
        usage: result.usage,
      },
    }
  }
  catch (error) {
    const errorDetails = extractConnectionErrorDetails(error)
    return {
      ok: false,
      title: t`测试失败`,
      message: summariseConnectionError(errorDetails),
      details: {
        ...baseDetails,
        durationMs: Date.now() - startedAt,
        ...errorDetails,
      },
    }
  }
}

function extractConnectionErrorDetails(error: unknown): Record<string, unknown> {
  const responseBody = stringField(error, 'responseBody')
  const responseBodyDetails = extractResponseBodyDetails(responseBody)
  const cause = field(error, 'cause')
  return compactDetails({
    errorName: error instanceof Error ? error.name : typeof error,
    errorMessage: errorMessage(error),
    statusCode: numberField(error, 'statusCode'),
    requestURL: stringField(error, 'url'),
    isRetryable: booleanField(error, 'isRetryable'),
    responseHeaders: field(error, 'responseHeaders'),
    responseBody,
    ...responseBodyDetails,
    data: field(error, 'data'),
    causeName: cause instanceof Error ? cause.name : undefined,
    causeMessage: cause instanceof Error ? cause.message : undefined,
    requestBodyValues: field(error, 'requestBodyValues'),
    errorStack: error instanceof Error ? error.stack : undefined,
  })
}

function summariseConnectionError(details: Record<string, unknown>): string {
  const parts = [
    typeof details.statusCode === 'number' ? `HTTP ${details.statusCode}` : '',
    typeof details.responseBodyMessage === 'string' ? details.responseBodyMessage : '',
    typeof details.errorMessage === 'string' ? details.errorMessage : '',
  ].filter(Boolean)
  const uniqueParts = [...new Set(parts)]
  return uniqueParts.length > 0 ? uniqueParts.join(' · ') : t`模型连接测试失败，未返回可读错误信息。`
}

function extractResponseBodyDetails(responseBody: string | undefined): Record<string, unknown> {
  if (!responseBody)
    return {}
  try {
    const parsed = JSON.parse(responseBody) as unknown
    const parsedMessage = responseBodyMessage(parsed)
    const parsedType = responseErrorType(parsed)
    return compactDetails({
      responseBodyParsed: parsed,
      responseBodyMessage: parsedMessage,
      responseErrorType: parsedType,
    })
  }
  catch {
    return {
      responseBodyMessage: responseBody.trim(),
    }
  }
}

function responseBodyMessage(value: unknown): string | undefined {
  if (typeof value === 'string')
    return value
  if (!isRecord(value))
    return undefined
  if (typeof value.message === 'string')
    return value.message
  if (typeof value.detail === 'string')
    return value.detail
  if (typeof value.error === 'string')
    return value.error
  return responseBodyMessage(value.error)
}

function responseErrorType(value: unknown): string | undefined {
  if (!isRecord(value))
    return undefined
  if (typeof value.type === 'string' && value.type !== 'error')
    return value.type
  if (isRecord(value.error) && typeof value.error.type === 'string')
    return value.error.type
  return undefined
}

function errorMessage(error: unknown): string {
  if (error instanceof Error)
    return error.message
  if (typeof error === 'string')
    return error
  return String(error)
}

function field(error: unknown, key: string): unknown {
  return isRecord(error) ? error[key] : undefined
}

function stringField(error: unknown, key: string): string | undefined {
  const value = field(error, key)
  return typeof value === 'string' ? value : undefined
}

function numberField(error: unknown, key: string): number | undefined {
  const value = field(error, key)
  return typeof value === 'number' ? value : undefined
}

function booleanField(error: unknown, key: string): boolean | undefined {
  const value = field(error, key)
  return typeof value === 'boolean' ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function compactDetails(details: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== undefined && value !== ''),
  )
}
