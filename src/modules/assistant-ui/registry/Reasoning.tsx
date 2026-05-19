/* eslint-disable react-refresh/only-export-components */
'use client'

import { memo } from 'react'
import type { ReasoningGroupComponent, ReasoningMessagePartComponent } from '@assistant-ui/react'
import { useAuiState } from '@assistant-ui/react'
import { MarkdownText } from '@/modules/assistant-ui/registry/MarkdownText'
import {
  ReasoningContent,
  ReasoningFade,
  ReasoningRoot,
  ReasoningText,
  ReasoningTrigger,
  reasoningVariants,
} from '@/modules/assistant-ui/registry/reasoning-primitives'

// Default Reasoning message-part component for assistant-ui. Pulls in the
// markdown bundle (and its dot.css side-effect). Callers that only need the
// collapsible primitives should import from reasoning-primitives instead.

const ReasoningImpl: ReasoningMessagePartComponent = () => <MarkdownText />

const ReasoningGroupImpl: ReasoningGroupComponent = ({
  children,
  startIndex,
  endIndex,
}) => {
  const isReasoningStreaming = useAuiState((s) => {
    if (s.message.status?.type !== 'running')
      return false
    const lastIndex = s.message.parts.length - 1
    if (lastIndex < 0)
      return false
    const lastType = s.message.parts[lastIndex]?.type
    if (lastType !== 'reasoning')
      return false
    return lastIndex >= startIndex && lastIndex <= endIndex
  })

  return (
    <ReasoningRoot defaultOpen={isReasoningStreaming}>
      <ReasoningTrigger active={isReasoningStreaming} />
      <ReasoningContent aria-busy={isReasoningStreaming}>
        <ReasoningText>{children}</ReasoningText>
      </ReasoningContent>
    </ReasoningRoot>
  )
}

const Reasoning = memo(
  ReasoningImpl,
) as unknown as ReasoningMessagePartComponent & {
  Root: typeof ReasoningRoot
  Trigger: typeof ReasoningTrigger
  Content: typeof ReasoningContent
  Text: typeof ReasoningText
  Fade: typeof ReasoningFade
}

Reasoning.displayName = 'Reasoning'
Reasoning.Root = ReasoningRoot
Reasoning.Trigger = ReasoningTrigger
Reasoning.Content = ReasoningContent
Reasoning.Text = ReasoningText
Reasoning.Fade = ReasoningFade

/**
 * @deprecated This wrapper targets the legacy `components.ReasoningGroup`
 * prop on `<MessagePrimitive.Parts>`. Use `<MessagePrimitive.GroupedParts>`
 * with a `groupBy` returning `"group-reasoning"` and compose `ReasoningRoot`
 * / `ReasoningTrigger` / `ReasoningContent` / `ReasoningText` directly.
 * See `thread.tsx` for an example.
 */
const ReasoningGroup = memo(ReasoningGroupImpl)
ReasoningGroup.displayName = 'ReasoningGroup'

export {
  Reasoning,
  ReasoningContent,
  ReasoningFade,
  ReasoningGroup,
  ReasoningRoot,
  ReasoningText,
  ReasoningTrigger,
  reasoningVariants,
}
