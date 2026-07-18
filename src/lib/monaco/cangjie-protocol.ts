import type { Middleware } from 'vscode-languageclient/browser'
import { CANGJIE_LANGUAGE_NAME } from './language'

const DID_OPEN_METHOD = 'textDocument/didOpen'

interface DidOpenParams {
  textDocument: {
    languageId: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

function notificationMethod(type: Parameters<NonNullable<Middleware['sendNotification']>>[0]): string {
  return typeof type === 'string' ? type : type.method
}

/**
 * The WASM Cangjie LSP uses the display name "Cangjie" as its protocol
 * language identity. Monaco's registry intentionally uses lowercase
 * "cangjie", so translate only at the JSON-RPC boundary.
 */
export function createCangjieProtocolMiddleware(): Middleware {
  const sendNotification: NonNullable<Middleware['sendNotification']> = async (type, next, params) => {
    if (notificationMethod(type) !== DID_OPEN_METHOD)
      return next(type, params)

    const didOpen = params as typeof params & DidOpenParams
    return next(type, {
      ...didOpen,
      textDocument: {
        ...didOpen.textDocument,
        languageId: CANGJIE_LANGUAGE_NAME,
      },
    } as typeof params)
  }

  return {
    sendNotification,
  }
}
