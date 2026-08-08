'use client'

import { useCallback, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { MessageCircle, Sparkles, X } from 'lucide-react'
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { CHAT_MIN_WIDTH, useResizableChatPanel } from '@/features/teach/hooks/use-resizable-chat-panel'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import { useIsCompactViewport } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { WorkspaceNav } from './WorkspaceNav'
import { WorkspaceViewport } from './WorkspaceViewport'
import { PlaygroundEditorHost } from './views/PlaygroundEditorHost'

export interface TeachWorkspaceShellProps {
  chat: ReactNode
}

function WorkspaceViewTransition({
  children,
  reduceMotion,
  view,
}: {
  children: ReactNode
  reduceMotion: boolean
  view: string
}) {
  const present = useIsPresent()
  return (
    <motion.div
      data-testid="workspace-view-transition"
      data-view={view}
      aria-hidden={present ? undefined : true}
      inert={!present}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.14, ease: 'easeOut' }}
      className={cn(
        'absolute inset-0 h-full min-h-0 w-full bg-background',
        !present && 'pointer-events-none',
        view === 'playground'
          ? 'overflow-hidden'
          : 'overflow-y-auto px-4 py-7 sm:px-6 lg:px-8 lg:py-8',
      )}
    >
      {children}
    </motion.div>
  )
}

function useResponsiveChatOpen(
  compact: boolean,
  pendingPrefill: string | null,
) {
  const [chatOpen, setChatOpen] = useState(
    compact && pendingPrefill !== null,
  )
  const [observed, setObserved] = useState({ compact, pendingPrefill })
  if (
    observed.compact !== compact
    || observed.pendingPrefill !== pendingPrefill
  ) {
    const enteredCompact = compact && !observed.compact
    const receivedCompactPrefill = compact
      && pendingPrefill !== null
      && (
        observed.pendingPrefill !== pendingPrefill
        || !observed.compact
      )
    setObserved({ compact, pendingPrefill })
    if (receivedCompactPrefill)
      setChatOpen(true)
    else if (enteredCompact)
      setChatOpen(false)
  }
  return [chatOpen, setChatOpen] as const
}

/** Responsive shell around the canonical Live, Review, Progress, and Chat surfaces. */
export function TeachWorkspaceShell({ chat }: TeachWorkspaceShellProps) {
  const { lang } = useWorkspace()
  const view = useWorkspaceStore(state => state.view)
  const pendingPrefill = useWorkspaceStore(state => state.pendingPrefill)
  const compact = useIsCompactViewport()
  const [chatOpen, setChatOpen] = useResponsiveChatOpen(
    compact,
    pendingPrefill,
  )
  const reduceMotion = useReducedMotion() === true
  const chatRegionId = useId()
  const chatTitleId = useId()
  const chatToggleRef = useRef<HTMLButtonElement>(null)
  const mobileChatRef = useRef<HTMLDivElement>(null)
  const { chatMaxWidth, chatRef, chatWidth, onHandleKeyDown, startResize } = useResizableChatPanel()
  const english = lang === 'en'

  const closeChat = useCallback(() => {
    setChatOpen(false)
    requestAnimationFrame(() => chatToggleRef.current?.focus())
  }, [setChatOpen])

  return (
    <div
      data-testid="teach-workspace-shell"
      className="relative grid h-full min-h-0 w-full grid-cols-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-background text-foreground md:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[13rem_minmax(0,1fr)_auto] lg:grid-rows-1"
    >
      <aside
        className="teach-scrollbar-hidden relative col-start-1 row-start-1 min-w-0 overflow-x-auto border-b border-border bg-sidebar px-2 py-2 md:col-span-2 lg:col-span-1 lg:col-start-1 lg:row-start-1 lg:flex lg:w-52 lg:flex-col lg:border-e lg:border-b-0 lg:px-3 lg:py-4"
      >
        <WorkspaceNav />
      </aside>

      <main
        data-testid="workspace-viewport"
        className="relative col-start-1 row-start-2 min-h-0 min-w-0 overflow-hidden bg-background lg:col-start-2 lg:row-start-1"
      >
        <PlaygroundEditorHost>
          <AnimatePresence initial={false} mode="wait">
            <WorkspaceViewTransition key={view} reduceMotion={reduceMotion} view={view}>
              <div className={view === 'playground'
                ? 'h-full min-h-0 w-full'
                : 'mx-auto w-full max-w-4xl'}
              >
                <WorkspaceViewport view={view} />
              </div>
            </WorkspaceViewTransition>
          </AnimatePresence>
        </PlaygroundEditorHost>
      </main>

      {compact
        ? (
            <Sheet
              open={chatOpen}
              onOpenChange={(open) => {
                if (open)
                  setChatOpen(true)
                else
                  closeChat()
              }}
            >
              <SheetTrigger asChild>
                <Button
                  ref={chatToggleRef}
                  type="button"
                  size="icon-lg"
                  data-testid="workspace-chat-toggle"
                  aria-label={english ? 'Open teacher chat' : '打开老师对话'}
                  aria-controls={chatRegionId}
                  className={cn(
                    'fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] end-4 z-20 size-12 rounded-md shadow-md',
                    chatOpen && 'hidden',
                  )}
                >
                  <MessageCircle aria-hidden="true" className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                ref={mobileChatRef}
                id={chatRegionId}
                data-testid="workspace-chat"
                data-open={chatOpen ? 'true' : 'false'}
                side="bottom"
                showCloseButton={false}
                onOpenAutoFocus={(event) => {
                  event.preventDefault()
                  requestAnimationFrame(() => {
                    mobileChatRef.current?.querySelector<HTMLElement>('textarea:not([disabled])')?.focus()
                  })
                }}
                className="teach-workspace-theme h-[min(78dvh,46rem)] gap-0 overflow-hidden rounded-t-lg border-t border-border p-0"
              >
                <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Sparkles aria-hidden="true" className="size-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <SheetTitle className="truncate text-sm font-semibold">
                        {english ? 'Lesson Orchestrator' : '课程编排老师'}
                      </SheetTitle>
                      <SheetDescription className="truncate text-[11px]">
                        {english ? 'Chat is temporary unless explicitly retained' : '对话默认临时，只有结构化材料会被保留'}
                      </SheetDescription>
                    </div>
                  </div>
                  <SheetClose asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={english ? 'Close teacher chat' : '收起老师对话'}
                    >
                      <X aria-hidden="true" className="size-4" />
                    </Button>
                  </SheetClose>
                </div>
                <div className="min-h-0 flex-1 pb-[env(safe-area-inset-bottom)]">{chat}</div>
              </SheetContent>
            </Sheet>
          )
        : (
            <section
              ref={chatRef}
              id={chatRegionId}
              data-testid="workspace-chat"
              aria-labelledby={chatTitleId}
              style={{ width: chatWidth }}
              className="relative col-start-2 row-start-2 flex shrink-0 flex-col border-s border-border bg-background lg:col-start-3 lg:row-start-1"
            >
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label={english ? 'Resize chat panel' : '调整对话栏宽度'}
                aria-valuenow={Math.round(chatWidth)}
                aria-valuemin={CHAT_MIN_WIDTH}
                aria-valuemax={Math.round(chatMaxWidth)}
                tabIndex={0}
                onPointerDown={startResize}
                onKeyDown={onHandleKeyDown}
                className="group absolute inset-y-0 -start-1 z-20 w-2 cursor-col-resize touch-none"
              >
                <span className="absolute inset-y-0 start-1/2 w-px -translate-x-1/2 bg-border/80 transition-colors group-hover:bg-primary/60 group-focus-visible:w-0.5 group-focus-visible:bg-primary" />
              </div>
              <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Sparkles aria-hidden="true" className="size-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <h2 id={chatTitleId} className="truncate text-sm font-semibold">
                      {english ? 'Lesson Orchestrator' : '课程编排老师'}
                    </h2>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {english ? 'Chat is temporary unless explicitly retained' : '对话默认临时，只有结构化材料会被保留'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="min-h-0 flex-1">{chat}</div>
            </section>
          )}
    </div>
  )
}
