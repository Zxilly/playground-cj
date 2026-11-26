import {
  SuggestionPrimitive,
  ThreadPrimitive,
  useAuiState,
} from '@assistant-ui/react'
import { Trans } from '@lingui/react/macro'
import { Sparkles } from 'lucide-react'
import type { FC } from 'react'
import { Button } from '@/components/ui/button'

export interface ThreadWelcomeSuggestion {
  prompt: string
  title: string
  description?: string
}

export interface ThreadWelcomeProps {
  /** Contextual quick-ask prompts displayed in the welcome grid. */
  suggestions?: readonly ThreadWelcomeSuggestion[]
}

export const ThreadWelcome: FC<ThreadWelcomeProps> = ({ suggestions }) => {
  const runtimeSuggestionCount = useAuiState(s => s.thread.suggestions?.length ?? 0)
  const hasCustomSuggestions = Boolean(suggestions && suggestions.length > 0)
  const hasRuntimeSuggestions = runtimeSuggestionCount > 0
  const hasSuggestions = hasCustomSuggestions || hasRuntimeSuggestions

  return (
    <div className="aui-thread-welcome-root my-auto flex grow flex-col justify-center py-8">
      <div className="aui-thread-welcome-center flex w-full flex-col items-start justify-center">
        <div className="aui-thread-welcome-message flex w-full flex-col px-2 sm:px-3">
          <span className="mb-3 inline-flex text-muted-foreground">
            <Sparkles aria-hidden="true" className="size-5" />
          </span>
          {hasSuggestions && (
            <h3 className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in fill-mode-both text-xl font-semibold tracking-[-0.02em] duration-200 motion-reduce:animate-none">
              <Trans>可以这样问</Trans>
            </h3>
          )}
          <p className="aui-thread-welcome-message-inner mt-1.5 max-w-md text-pretty fade-in slide-in-from-bottom-1 animate-in fill-mode-both text-sm leading-6 text-muted-foreground delay-75 duration-200 motion-reduce:animate-none">
            <Trans>可以询问当前概念、练习要求、代码问题，或让讲解更慢一些。</Trans>
          </p>
        </div>
      </div>
      {hasSuggestions && (
        <ThreadSuggestions
          customSuggestions={hasCustomSuggestions ? suggestions : undefined}
          includeRuntimeSuggestions={hasRuntimeSuggestions}
        />
      )}
    </div>
  )
}

function ThreadSuggestions({
  customSuggestions,
  includeRuntimeSuggestions,
}: {
  customSuggestions?: readonly ThreadWelcomeSuggestion[]
  includeRuntimeSuggestions: boolean
}) {
  return (
    <div className="aui-thread-welcome-suggestions mt-6 grid w-full gap-2 pb-2 @md:grid-cols-2">
      {customSuggestions?.map(item => (
        <CustomSuggestionItem key={`${item.title}:${item.prompt}`} suggestion={item} />
      ))}
      {includeRuntimeSuggestions && (
        <ThreadPrimitive.Suggestions>
          {() => <ThreadSuggestionItem />}
        </ThreadPrimitive.Suggestions>
      )}
    </div>
  )
}

function CustomSuggestionItem({ suggestion }: { suggestion: ThreadWelcomeSuggestion }) {
  return (
    <div className="aui-thread-welcome-suggestion-display fade-in slide-in-from-bottom-2 @md:nth-[n+3]:block nth-[n+3]:hidden animate-in fill-mode-both duration-200 motion-reduce:animate-none">
      <ThreadPrimitive.Suggestion prompt={suggestion.prompt} send asChild>
        <Button
          variant="ghost"
          className="aui-thread-welcome-suggestion h-auto w-full flex-col items-start justify-start gap-1 whitespace-normal rounded-md border border-border bg-background px-3 py-2.5 text-start text-sm leading-5 transition-colors hover:bg-muted hover:text-foreground"
        >
          <span className="aui-thread-welcome-suggestion-text-1 font-medium leading-5">
            {suggestion.title}
          </span>
          {suggestion.description && (
            <span className="aui-thread-welcome-suggestion-text-2 text-muted-foreground text-xs leading-4">
              {suggestion.description}
            </span>
          )}
        </Button>
      </ThreadPrimitive.Suggestion>
    </div>
  )
}

function ThreadSuggestionItem() {
  return (
    <div className="aui-thread-welcome-suggestion-display fade-in slide-in-from-bottom-2 @md:nth-[n+3]:block nth-[n+3]:hidden animate-in fill-mode-both duration-200 motion-reduce:animate-none">
      <SuggestionPrimitive.Trigger send asChild>
        <Button
          variant="ghost"
          className="aui-thread-welcome-suggestion h-auto w-full flex-col items-start justify-start gap-1 whitespace-normal rounded-md border border-border bg-background px-3 py-2.5 text-start text-sm leading-5 transition-colors hover:bg-muted hover:text-foreground"
        >
          <SuggestionPrimitive.Title className="aui-thread-welcome-suggestion-text-1 font-medium leading-5" />
          <SuggestionPrimitive.Description className="aui-thread-welcome-suggestion-text-2 text-muted-foreground text-xs leading-4 empty:hidden" />
        </Button>
      </SuggestionPrimitive.Trigger>
    </div>
  )
}
