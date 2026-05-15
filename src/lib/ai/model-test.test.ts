import { generateText } from 'ai'
import { describe, expect, it, vi } from 'vitest'
import { testLLMConnection } from './model-test'

vi.mock('ai', () => ({
  generateText: vi.fn(),
}))

vi.mock('@lingui/core/macro', () => ({
  t: (strings: TemplateStringsArray, ...values: unknown[]) => String.raw({ raw: strings }, ...values),
}))

const mockGenerateText = vi.mocked(generateText)

describe('model connection test', () => {
  it('returns a configuration error before calling the model when required fields are missing', async () => {
    const result = await testLLMConnection({
      provider: 'openai-compatible',
      baseURL: '',
      apiKey: '',
      model: '',
    })

    expect(result.ok).toBe(false)
    expect(result.title).toBe('配置不完整')
    expect(result.message).toContain('API Base、API Key、Model')
    expect(result.details).toMatchObject({
      missing: ['API Base', 'API Key', 'Model'],
      hasApiKey: false,
      apiKeyPreview: '',
    })
    expect(mockGenerateText).not.toHaveBeenCalled()
  })

  it('summarizes non-json response bodies and nested causes', async () => {
    const error = Object.assign(new Error('Bad gateway'), {
      responseBody: 'upstream unavailable',
      cause: new TypeError('network reset'),
      requestBodyValues: { model: 'debug-model' },
    })
    mockGenerateText.mockRejectedValueOnce(error)

    const result = await testLLMConnection({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'sk-user-secret-key',
      model: 'debug-model',
    })

    expect(result.ok).toBe(false)
    expect(result.message).toBe('upstream unavailable · Bad gateway')
    expect(result.details).toMatchObject({
      responseBodyMessage: 'upstream unavailable',
      causeName: 'TypeError',
      causeMessage: 'network reset',
      requestBodyValues: { model: 'debug-model' },
    })
  })

  it('returns AI SDK API call details for debugging failed connections', async () => {
    const error = Object.assign(new Error('Unauthorized'), {
      name: 'AI_APICallError',
      url: 'https://api.example.test/v1/chat/completions',
      statusCode: 401,
      responseHeaders: { 'x-request-id': 'req_test' },
      responseBody: JSON.stringify({
        error: {
          type: 'authentication_error',
          message: 'Invalid API key',
        },
      }),
      data: {
        error: {
          type: 'authentication_error',
          message: 'Invalid API key',
        },
      },
      isRetryable: false,
    })
    mockGenerateText.mockRejectedValueOnce(error)

    const result = await testLLMConnection({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'sk-user-secret-key',
      model: 'debug-model',
    })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('HTTP 401')
    expect(result.message).toContain('Invalid API key')
    expect(result.details).toMatchObject({
      errorName: 'AI_APICallError',
      errorMessage: 'Unauthorized',
      statusCode: 401,
      requestURL: 'https://api.example.test/v1/chat/completions',
      responseHeaders: { 'x-request-id': 'req_test' },
      responseBody: '{"error":{"type":"authentication_error","message":"Invalid API key"}}',
      responseBodyMessage: 'Invalid API key',
      responseErrorType: 'authentication_error',
      data: {
        error: {
          type: 'authentication_error',
          message: 'Invalid API key',
        },
      },
      isRetryable: false,
    })
    expect(JSON.stringify(result.details)).not.toContain('sk-user-secret-key')
  })

  it('returns the model response, finish reason, and usage for a successful connection test', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: ' OK ',
      finishReason: 'stop',
      usage: {
        inputTokens: 4,
        outputTokens: 1,
        totalTokens: 5,
      },
    } as Awaited<ReturnType<typeof generateText>>)

    const result = await testLLMConnection({
      provider: 'openai-compatible',
      baseURL: 'https://api.example.test/v1',
      apiKey: 'sk-user-secret-key',
      model: 'debug-model',
    })

    expect(result).toMatchObject({
      ok: true,
      title: '测试成功',
      message: '模型返回：OK',
      details: {
        responseText: 'OK',
        finishReason: 'stop',
        usage: {
          inputTokens: 4,
          outputTokens: 1,
          totalTokens: 5,
        },
      },
    })
  })
})
