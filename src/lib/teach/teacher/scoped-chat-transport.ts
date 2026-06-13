import type { Agent, ChatTransport, ToolSet, UIMessage } from 'ai'
import { DirectChatTransport } from 'ai'

function mergeSignal(upstream: AbortSignal | undefined, scope: AbortSignal): AbortSignal {
  if (!upstream)
    return scope
  return AbortSignal.any([upstream, scope])
}

type AnyAgent = Agent<any, ToolSet, any>

/**
 * Wrap a browser-side {@link Agent} in a {@link ChatTransport} whose every
 * `sendMessages` call is bound to a workspace-scoped {@link AbortSignal}. When
 * the workspace unmounts (signal aborts) the in-flight teacher turn is cancelled
 * — the scope signal is merged with any per-call signal assistant-ui supplies,
 * so both the caller's stop button and the workspace teardown abort the stream.
 *
 * Migrated from the legacy classroom transport; kept under `lib/teach` so the
 * teacher chat does not depend on the removed AI Classroom stack.
 */
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
