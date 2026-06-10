import {
  SuggestionPrimitive,
  ThreadPrimitive,
} from '@assistant-ui/react'
import { Trans } from '@lingui/react/macro'
import type { FC } from 'react'
import { Button } from '@/components/ui/button'

export const ThreadWelcome: FC = () => {
  return (
    <div className="aui-thread-welcome-root my-auto flex grow flex-col">
      <div className="aui-thread-welcome-center flex w-full grow flex-col items-center justify-center">
        <div className="aui-thread-welcome-message flex size-full flex-col justify-center px-4">
          <h1 className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in fill-mode-both font-semibold text-2xl duration-200">
            <Trans>可以这样问</Trans>
          </h1>
          <p className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in fill-mode-both text-muted-foreground text-base delay-75 duration-200">
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
    <div className="aui-thread-welcome-suggestions grid w-full @md:grid-cols-2 gap-2 pb-4">
      <ThreadPrimitive.Suggestions>
        {() => <ThreadSuggestionItem />}
      </ThreadPrimitive.Suggestions>
    </div>
  )
}

function ThreadSuggestionItem() {
  return (
    <div className="aui-thread-welcome-suggestion-display fade-in slide-in-from-bottom-2 @md:nth-[n+3]:block nth-[n+3]:hidden animate-in fill-mode-both duration-200">
      <SuggestionPrimitive.Trigger send asChild>
        <Button
          variant="ghost"
          className="aui-thread-welcome-suggestion h-auto w-full flex-col items-start justify-start gap-1 whitespace-normal rounded-md border bg-background px-3 py-2.5 text-start text-sm leading-5 transition-colors hover:bg-muted"
        >
          <SuggestionPrimitive.Title className="aui-thread-welcome-suggestion-text-1 font-medium leading-5" />
          <SuggestionPrimitive.Description className="aui-thread-welcome-suggestion-text-2 text-muted-foreground text-xs leading-4 empty:hidden" />
        </Button>
      </SuggestionPrimitive.Trigger>
    </div>
  )
}
