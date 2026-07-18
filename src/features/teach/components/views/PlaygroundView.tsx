'use client'

import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { FileCode2, Loader2, Play, Plus, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { t } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import type { PlaygroundTab } from '@/features/teach/state/workspace-store'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import { useActiveEditorRegistration } from '@/features/teach/hooks/use-active-editor-registration'
import type { CodeTaskEditorHandle } from '@/features/teach/components/blocks/CodeTaskBlock'
import { CompilerDiagnosticOutput } from '@/features/teach/components/blocks/CompilerDiagnosticOutput'
import { DynamicCodeTaskMonacoEditor } from '@/features/teach/components/blocks/DynamicCodeTaskMonacoEditor'
import { defaultRunner } from '@/lib/teach/feedback/run-cangjie'

/**
 * Ephemeral multi-buffer workspace for demonstrations, experiments, and other
 * code that should stay visible without becoming durable lesson content.
 */
export function PlaygroundView() {
  // The tab strip renders and reorders the whole collection; one collection
  // subscription is the granular state this view needs.
  // eslint-disable-next-line granular-selectors/granular-selectors
  const tabs = useWorkspaceStore(state => state.playgroundTabs)
  const activeId = useWorkspaceStore(state => state.currentPlaygroundTabId)
  const openTab = useWorkspaceStore(state => state.openPlaygroundTab)
  const selectTab = useWorkspaceStore(state => state.selectPlaygroundTab)
  const closeTab = useWorkspaceStore(state => state.closePlaygroundTab)
  const activeTab = tabs.find(tab => tab.id === activeId) ?? null
  const tabElementRef = useRef(new Map<string, HTMLDivElement>())

  const focusTab = (id: string) => {
    selectTab(id)
    tabElementRef.current.get(id)?.focus()
  }

  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>, index: number) => {
    let nextIndex: number | null = null
    if (event.key === 'ArrowLeft')
      nextIndex = index === 0 ? tabs.length - 1 : index - 1
    else if (event.key === 'ArrowRight')
      nextIndex = index === tabs.length - 1 ? 0 : index + 1
    else if (event.key === 'Home')
      nextIndex = 0
    else if (event.key === 'End')
      nextIndex = tabs.length - 1

    if (nextIndex === null)
      return
    event.preventDefault()
    const tab = tabs[nextIndex]
    if (tab)
      focusTab(tab.id)
  }

  return (
    <section data-testid="playground-view" className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background">
      <h2 className="sr-only">Playground</h2>
      <div className="flex h-10 shrink-0 items-stretch border-b border-border bg-muted/35 shadow-[inset_0_-1px_0_hsl(var(--border))]">
        <div
          role="tablist"
          aria-label={t`Playground 标签页`}
          className="teach-scrollbar-hidden flex min-w-0 flex-1 overflow-x-auto"
        >
          {tabs.map((tab, index) => (
            <div
              key={tab.id}
              ref={(node) => {
                if (node)
                  tabElementRef.current.set(tab.id, node)
                else
                  tabElementRef.current.delete(tab.id)
              }}
              data-testid="playground-tab"
              data-ide-tab
              data-active={tab.id === activeId ? 'true' : 'false'}
              id={`playground-tab-${tab.id}`}
              role="tab"
              aria-controls={`playground-panel-${tab.id}`}
              aria-selected={tab.id === activeId}
              tabIndex={tab.id === activeId ? 0 : -1}
              onClick={() => selectTab(tab.id)}
              onKeyDown={event => handleTabKeyDown(event, index)}
              className="group relative flex h-10 min-w-36 max-w-56 shrink-0 cursor-default items-center gap-2 border-e border-border/80 px-2.5 text-[13px] outline-none transition-colors data-[active=false]:bg-muted/15 data-[active=false]:text-muted-foreground hover:bg-muted/60 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/45 data-[active=true]:bg-background data-[active=true]:text-foreground"
            >
              {tab.id === activeId && (
                <motion.span
                  layoutId="playground-active-tab-indicator"
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-0.5 bg-primary"
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                />
              )}
              <FileCode2
                aria-hidden="true"
                className="size-3.5 shrink-0 text-muted-foreground transition-colors group-data-[active=true]:text-primary"
              />
              <span className="min-w-0 flex-1 truncate font-medium">{tab.title}</span>
              <button
                type="button"
                data-testid="playground-close-tab"
                tabIndex={tab.id === activeId ? 0 : -1}
                onClick={(event) => {
                  event.stopPropagation()
                  closeTab(tab.id)
                }}
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground opacity-0 transition-[opacity,background-color,color] hover:bg-muted-foreground/15 hover:text-foreground focus:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary group-hover:opacity-100 group-data-[active=true]:opacity-70"
                aria-label={`${t`关闭标签页`}: ${tab.title}`}
              >
                <X aria-hidden="true" className="size-3" />
              </button>
            </div>
          ))}
          <button
            type="button"
            data-testid="playground-new-tab"
            onClick={() => openTab()}
            className="m-1 inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/45"
            aria-label={t`新建 Playground 标签页`}
          >
            <Plus aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>

      {activeTab
        ? tabs.map(tab => (
            <PlaygroundEditorPane
              key={tab.id}
              tab={tab}
              active={tab.id === activeId}
            />
          ))
        : (
            <div className="grid flex-1 place-items-center p-8 text-center">
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm text-muted-foreground"><Trans>暂无 Playground 标签页。</Trans></p>
                <button
                  type="button"
                  onClick={() => openTab()}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                >
                  <Plus aria-hidden="true" className="size-4" />
                  <Trans>新建标签页</Trans>
                </button>
              </div>
            </div>
          )}
    </section>
  )
}

function PlaygroundEditorPane({ tab, active }: { tab: PlaygroundTab, active: boolean }) {
  const { i18n } = useLingui()
  const { activeEditor, runner } = useWorkspace()
  const setResult = useWorkspaceStore(state => state.setPlaygroundTabResult)
  const handleRef = useRef<CodeTaskEditorHandle | null>(null)
  const [running, setRunning] = useState(false)
  // All Playground editors stay mounted so switching tabs never tears down the
  // shared Cangjie language service. Only the visible tab becomes the teacher's
  // active editor.
  const activateEditor = useActiveEditorRegistration(activeEditor, handleRef, false)

  useEffect(() => {
    if (active)
      activateEditor()
  }, [active, activateEditor])

  const run = async () => {
    if (running)
      return
    const code = handleRef.current?.getCode() ?? tab.initialCode
    setRunning(true)
    try {
      const result = await (runner ?? defaultRunner).run(code)
      setResult(tab.id, result)
    }
    finally {
      setRunning(false)
    }
  }

  return (
    <div
      id={`playground-panel-${tab.id}`}
      role="tabpanel"
      aria-labelledby={`playground-tab-${tab.id}`}
      hidden={!active}
      aria-hidden={!active}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div
        data-testid="playground-editor"
        aria-label={t`Playground 代码编辑区`}
        onFocusCapture={activateEditor}
        onClick={activateEditor}
        className="flex min-h-0 flex-1"
      >
        <DynamicCodeTaskMonacoEditor
          initialCode={tab.initialCode}
          handleRef={handleRef}
          locale={i18n.locale}
          uriHint={`teach:playground:${tab.id}`}
          modelScope="teach:playground"
          fillHeight
        />
      </div>

      <div data-testid="playground-output" className="flex h-44 shrink-0 flex-col border-t border-border bg-background">
        <div className="flex h-11 shrink-0 items-center gap-3 border-b border-border bg-muted/20 px-2">
          <button
            type="button"
            data-testid="playground-run"
            disabled={running}
            onClick={() => void run()}
            className="inline-flex h-8 items-center gap-2 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:brightness-95 disabled:opacity-50"
          >
            {running
              ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
              : <Play aria-hidden="true" className="size-3.5" />}
            {running ? <Trans>运行中</Trans> : <Trans>运行</Trans>}
          </button>
          <span className="text-xs font-semibold text-muted-foreground"><Trans>程序输出</Trans></span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3">
          {tab.result
            ? (
                tab.result.ok
                  ? (
                      <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-6 text-foreground">
                        {tab.result.stdout || tab.result.stderr || '✓'}
                      </pre>
                    )
                  : (
                      <CompilerDiagnosticOutput
                        output={tab.result.compilerOutput ?? (tab.result.stderr || tab.result.stdout)}
                        testId="playground-stderr"
                      />
                    )
              )
            : <p className="text-xs text-muted-foreground"><Trans>运行当前标签页后，结果会显示在这里。</Trans></p>}
        </div>
      </div>
    </div>
  )
}
