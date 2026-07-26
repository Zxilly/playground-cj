import { describe, expect, it, vi } from 'vitest'
import { createCangjieProtocolMiddleware } from './cangjie-protocol'

describe('createCangjieProtocolMiddleware', () => {
  it('uses the language identity required by the Cangjie WASM server for didOpen', async () => {
    const middleware = createCangjieProtocolMiddleware()
    const next = vi.fn(async () => {})
    const type = 'textDocument/didOpen'
    const params = {
      textDocument: {
        uri: 'file:///playground/main.cj',
        languageId: 'cangjie',
        version: 1,
        text: 'main() {}',
      },
    }

    await middleware.sendNotification!(
      type,
      next,
      params,
    )

    expect(next).toHaveBeenCalledWith(
      type,
      {
        textDocument: {
          ...params.textDocument,
          languageId: 'Cangjie',
        },
      },
    )
    expect(params.textDocument.languageId).toBe('cangjie')
  })

  it('passes unrelated notifications through unchanged', async () => {
    const middleware = createCangjieProtocolMiddleware()
    const next = vi.fn(async () => {})
    const type = 'textDocument/didSave'
    const params = {
      textDocument: {
        uri: 'file:///playground/main.cj',
      },
    }

    await middleware.sendNotification!(
      type,
      next,
      params,
    )

    expect(next).toHaveBeenCalledWith(type, params)
  })
})
