import { DirectChatTransport } from 'ai'
import type { Agent, ChatTransport, ToolSet, UIMessage } from 'ai'

function mergeSignal(upstream: AbortSignal | undefined, scope: AbortSignal): AbortSignal {
  if (!upstream)
    return scope
  return AbortSignal.any([upstream, scope])
}

type AnyAgent = Agent<any, ToolSet, any>

export function createScopedChatTransport<UI extends UIMessage = UIMessage>(
  agent: AnyAgent,
  scopeSignal: AbortSignal,
): ChatTransport<UI> {
  const inner = new DirectChatTransport({ agent }) as unknown as ChatTransport<UI>

  return {
    sendMessages(opts) {
      return inner.sendMessages({ ...opts, abortSignal: mergeSignal(opts.abortSignal, scopeSignal) })
    },
    reconnectToStream(opts) {
      // ChatTransport.reconnectToStream options do not include abortSignal; just delegate.
      return inner.reconnectToStream(opts)
    },
  }
}
