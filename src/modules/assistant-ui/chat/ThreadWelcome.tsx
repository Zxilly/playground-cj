import {
  SuggestionPrimitive,
  ThreadPrimitive,
} from '@assistant-ui/react'
import { Trans } from '@lingui/react/macro'
import { Sparkles } from 'lucide-react'
import type { FC } from 'react'
import { Button } from '@/components/ui/button'

export const ThreadWelcome: FC = () => {
  return (
    <div className="aui-thread-welcome-root my-auto flex grow flex-col justify-center py-8">
      <div className="aui-thread-welcome-center flex w-full flex-col items-start justify-center">
        <div className="aui-thread-welcome-message flex w-full flex-col px-2 sm:px-3">
          <span className="mb-3 inline-flex text-muted-foreground">
            <Sparkles aria-hidden="true" className="size-5" />
          </span>
          <h1 className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in fill-mode-both text-xl font-semibold tracking-[-0.02em] duration-200 motion-reduce:animate-none">
            <Trans>可以这样问</Trans>
          </h1>
          <p className="aui-thread-welcome-message-inner mt-1.5 max-w-md text-pretty fade-in slide-in-from-bottom-1 animate-in fill-mode-both text-sm leading-6 text-muted-foreground delay-75 duration-200 motion-reduce:animate-none">
            <Trans>可以询问当前概念、练习要求、代码问题，或让讲解更慢一些。</Trans>
          </p>
        </div>
      </div>
      <ThreadSuggestions />
    </div>
  )
}

function ThreadSuggestions() {
  return (
    <div className="aui-thread-welcome-suggestions mt-6 grid w-full gap-2 pb-2 @md:grid-cols-2">
      <ThreadPrimitive.Suggestions>
        {() => <ThreadSuggestionItem />}
      </ThreadPrimitive.Suggestions>
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
