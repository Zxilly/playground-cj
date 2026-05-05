import { generateText } from 'ai'
import { describe, expect, it, vi } from 'vitest'
import { testLLMConnection } from './model-test'

vi.mock('ai', () => ({
  generateText: vi.fn(),
}))

const mockGenerateText = vi.mocked(generateText)

describe('model connection test', () => {
  it('prints AI SDK API call details for debugging failed connections', async () => {
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
})
