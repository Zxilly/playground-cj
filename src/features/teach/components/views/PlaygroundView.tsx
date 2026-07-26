'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { AlertTriangle, FileCode2, Loader2, Play, Plus, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { t } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import type { PlaygroundTab } from '@/features/teach/state/workspace-store'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import { useWorkspace } from '@/features/teach/context/useWorkspace'
import { CompilerDiagnosticOutput } from '@/features/teach/components/blocks/CompilerDiagnosticOutput'
import { AnsiOutput } from '@/components/AnsiOutput'
import { awaitWithSignal } from '@/lib/ai/abortable-operation'
import type { RunResult } from '@/lib/teach/feedback/run-cangjie'
import { usePlaygroundEditorHost } from './playground-editor-host-context'
import { useAbortScope } from '@/features/teach/context/abort-scope'

const DEFAULT_OUTPUT_HEIGHT = 176
const MIN_OUTPUT_HEIGHT = 112
const MIN_EDITOR_HEIGHT = 160
const FALLBACK_MAX_OUTPUT_HEIGHT = 480
const OUTPUT_KEYBOARD_STEP = 24
let nextPlaygroundRunOwnerEpoch = 1

interface ActivePlaygroundRun {
  controller: AbortController
  tabId: string
  contentVersion: string
}

function clampOutputHeight(height: number, maxHeight: number): number {
  return Math.min(Math.max(height, MIN_OUTPUT_HEIGHT), maxHeight)
}

/**
 * Bounded, locally persisted multi-buffer scratch workspace for demonstrations
 * and experiments. Persistence failures stay visible and drafts never become
 * classroom evidence.
 */
export function PlaygroundView() {
  const { flushPendingCode } = usePlaygroundEditorHost()
  // The tab strip renders and reorders the whole collection; one collection
  // subscription is the granular state this view needs.
  // eslint-disable-next-line granular-selectors/granular-selectors
  const tabs = useWorkspaceStore(state => state.playgroundTabs)
  const activeId = useWorkspaceStore(state => state.currentPlaygroundTabId)
  const openTab = useWorkspaceStore(state => state.openPlaygroundTab)
  const selectTab = useWorkspaceStore(state => state.selectPlaygroundTab)
  const closeTab = useWorkspaceStore(state => state.closePlaygroundTab)
  const renameTab = useWorkspaceStore(state => state.renamePlaygroundTab)
  const persistenceStatus = useWorkspaceStore(
    state => state.playgroundPersistenceStatus,
  )
  const persistenceError = useWorkspaceStore(state => state.playgroundPersistenceError)
  const conflict = useWorkspaceStore(state => state.playgroundConflict)
  const retryPersistence = useWorkspaceStore(state => state.retryPlaygroundPersistence)
  const resolveConflict = useWorkspaceStore(
    state => state.resolvePlaygroundConflict,
  )
  const activeTab = tabs.find(tab => tab.id === activeId) ?? null
  const tabElementRef = useRef(new Map<string, HTMLDivElement>())
  const [outputHeight, setOutputHeight] = useState(DEFAULT_OUTPUT_HEIGHT)
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const conflictRecoveryKey = conflict
    ? [
        conflict.tabId,
        conflict.kind,
        conflict.localTab.titleVersion,
        conflict.localTab.contentVersion,
        conflict.remoteTab?.titleVersion ?? 'deleted',
        conflict.remoteTab?.contentVersion ?? 'deleted',
        tabs.length,
      ].join(':')
    : null
  const [
    blockedConflictRecoveryKey,
    setBlockedConflictRecoveryKey,
  ] = useState<string | null>(null)
  const conflictRecoveryBlocked
    = conflictRecoveryKey !== null
      && blockedConflictRecoveryKey === conflictRecoveryKey

  const focusTab = (id: string) => {
    selectTab(id)
    tabElementRef.current.get(id)?.focus()
  }

  const startRenaming = (tab: PlaygroundTab) => {
    setEditingTabId(tab.id)
    setEditingTitle(tab.title)
  }

  const finishRenaming = (tabId: string) => {
    renameTab(tabId, editingTitle)
    setEditingTabId(null)
    setEditingTitle('')
    requestAnimationFrame(() => tabElementRef.current.get(tabId)?.focus())
  }

  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>, index: number) => {
    const current = tabs[index]
    if (event.key === 'F2' && current) {
      event.preventDefault()
      startRenaming(current)
      return
    }
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
              onDoubleClick={() => startRenaming(tab)}
              onKeyDown={event => handleTabKeyDown(event, index)}
              aria-keyshortcuts="F2"
              title={t`双击或按 F2 重命名`}
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
              {editingTabId === tab.id
                ? (
                    <input
                      autoFocus
                      data-testid="playground-tab-name"
                      aria-label={t`标签页名称`}
                      value={editingTitle}
                      onChange={event => setEditingTitle(event.target.value)}
                      onClick={event => event.stopPropagation()}
                      onDoubleClick={event => event.stopPropagation()}
                      onBlur={() => finishRenaming(tab.id)}
                      onKeyDown={(event) => {
                        event.stopPropagation()
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          finishRenaming(tab.id)
                        }
                        else if (event.key === 'Escape') {
                          event.preventDefault()
                          setEditingTabId(null)
                          setEditingTitle('')
                          requestAnimationFrame(() => tabElementRef.current.get(tab.id)?.focus())
                        }
                      }}
                      className="h-6 min-w-0 flex-1 rounded-sm border border-primary/50 bg-background px-1.5 text-[13px] font-medium text-foreground outline-none ring-1 ring-primary/20"
                    />
                  )
                : <span className="min-w-0 flex-1 truncate font-medium">{tab.title}</span>}
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
            disabled={persistenceStatus !== 'ready'}
            className="m-1 inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/45"
            aria-label={t`新建 Playground 标签页`}
          >
            <Plus aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>
      {persistenceStatus === 'opening' && (
        <div
          role="status"
          className="flex shrink-0 items-center gap-2 border-b border-border bg-muted/35 px-3 py-2 text-xs text-muted-foreground"
        >
          <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
          <Trans>正在打开 Playground 草稿存储…</Trans>
        </div>
      )}
      {persistenceError && (
        <div
          role="alert"
          data-testid="playground-persistence-error"
          className="flex shrink-0 items-center gap-2 border-b border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200"
        >
          <AlertTriangle aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1">
            {persistenceError === 'storage_unavailable'
              ? <Trans>Playground 草稿尚未保存：浏览器存储不可用。</Trans>
              : persistenceError === 'corrupt_workspace'
                ? <Trans>无法读取 v2 Playground 草稿；存储内容保持原样，系统不会迁移或覆盖它。</Trans>
                : persistenceError === 'conflict'
                  ? conflict?.kind === 'capacity'
                    ? <Trans>另一个窗口的修改与本地草稿合并后超过保存限额；已保存版本保持可用，你的草稿仍可恢复。</Trans>
                    : <Trans>另一个窗口已修改同一草稿；你的版本未覆盖远端版本。请选择恢复方式。</Trans>
                  : <Trans>这次 Playground 修改已被拒绝：标签页、标题或代码超过本地保存限额。</Trans>}
          </span>
          {persistenceError === 'conflict' && conflict && (
            <>
              <button
                type="button"
                onClick={() => {
                  flushPendingCode()
                  const recoveredId = resolveConflict('keep_copy')
                  setBlockedConflictRecoveryKey(
                    recoveredId === null ? conflictRecoveryKey : null,
                  )
                }}
                className="shrink-0 rounded border border-current/30 px-2 py-1 font-semibold hover:bg-amber-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
              >
                <Trans>另存为新标签页</Trans>
              </button>
              <button
                type="button"
                onClick={() => {
                  flushPendingCode()
                  resolveConflict('use_remote')
                }}
                className="shrink-0 rounded border border-current/30 px-2 py-1 font-semibold hover:bg-amber-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
              >
                <Trans>使用已保存版本</Trans>
              </button>
              {conflictRecoveryBlocked && (
                <span>
                  <Trans>无法另存副本；请先关闭一个标签页或缩短草稿后重试。</Trans>
                </span>
              )}
            </>
          )}
          {(persistenceError === 'storage_unavailable'
            || persistenceError === 'corrupt_workspace') && (
            <button
              type="button"
              onClick={retryPersistence}
              className="shrink-0 rounded border border-current/30 px-2 py-1 font-semibold hover:bg-amber-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
            >
              {persistenceError === 'corrupt_workspace'
                ? <Trans>重新读取</Trans>
                : <Trans>重试保存</Trans>}
            </button>
          )}
        </div>
      )}

      {activeTab
        ? (
            <PlaygroundEditorPane
              tab={activeTab}
              outputHeight={outputHeight}
              onOutputHeightChange={setOutputHeight}
            />
          )
        : (
            <div className="grid flex-1 place-items-center p-8 text-center">
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm text-muted-foreground"><Trans>暂无 Playground 标签页。</Trans></p>
                <button
                  type="button"
                  onClick={() => openTab()}
                  disabled={persistenceStatus !== 'ready'}
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

interface PlaygroundEditorPaneProps {
  tab: PlaygroundTab
  outputHeight: number
  onOutputHeightChange: (height: number | ((current: number) => number)) => void
}

function PlaygroundEditorPane({
  tab,
  outputHeight,
  onOutputHeightChange,
}: PlaygroundEditorPaneProps) {
  const { i18n } = useLingui()
  const { runner } = useWorkspace()
  const abortSignal = useAbortScope()
  const {
    activateEditor,
    editorHandleRef,
    flushPendingCode,
    registerEditorSlot,
  } = usePlaygroundEditorHost()
  const beginRun = useWorkspaceStore(state => state.beginPlaygroundTabRun)
  const finishRun = useWorkspaceStore(state => state.finishPlaygroundTabRun)
  const releaseRunOwner = useWorkspaceStore(state => state.releasePlaygroundRunOwner)
  const [runOwnerEpoch] = useState(() => nextPlaygroundRunOwnerEpoch++)
  const runControllersRef = useRef(new Map<string, ActivePlaygroundRun>())
  const paneRef = useRef<HTMLDivElement | null>(null)
  const resizeStateRef = useRef<{
    pointerId: number
    startY: number
    startHeight: number
    maxHeight: number
  } | null>(null)
  const running = tab.running

  const getMaxOutputHeight = useCallback(() => {
    const paneHeight = paneRef.current?.getBoundingClientRect().height ?? 0
    return paneHeight > MIN_EDITOR_HEIGHT + MIN_OUTPUT_HEIGHT
      ? paneHeight - MIN_EDITOR_HEIGHT
      : FALLBACK_MAX_OUTPUT_HEIGHT
  }, [])

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined' || !paneRef.current)
      return
    const observer = new ResizeObserver(([entry]) => {
      const maxHeight = Math.max(MIN_OUTPUT_HEIGHT, entry.contentRect.height - MIN_EDITOR_HEIGHT)
      onOutputHeightChange(current => clampOutputHeight(current, maxHeight))
    })
    observer.observe(paneRef.current)
    return () => observer.disconnect()
  }, [onOutputHeightChange])

  useEffect(() => {
    const controllers = runControllersRef.current
    return () => {
      for (const run of controllers.values())
        run.controller.abort(new DOMException('Playground pane unmounted.', 'AbortError'))
      controllers.clear()
      releaseRunOwner(runOwnerEpoch)
    }
  }, [releaseRunOwner, runOwnerEpoch])

  useEffect(() => {
    return useWorkspaceStore.subscribe((state) => {
      for (const [operationId, run] of runControllersRef.current) {
        const currentTab = state.playgroundTabs.find(
          candidate => candidate.id === run.tabId,
        )
        if (currentTab?.contentVersion === run.contentVersion)
          continue
        runControllersRef.current.delete(operationId)
        run.controller.abort(new DOMException(
          'Playground source changed while the run was in flight.',
          'AbortError',
        ))
        finishRun(run.tabId, operationId)
      }
    })
  }, [finishRun])

  const handleResizePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    resizeStateRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: outputHeight,
      maxHeight: getMaxOutputHeight(),
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handleResizePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const resize = resizeStateRef.current
    if (!resize || resize.pointerId !== event.pointerId)
      return
    onOutputHeightChange(clampOutputHeight(
      resize.startHeight + resize.startY - event.clientY,
      resize.maxHeight,
    ))
  }

  const stopResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (resizeStateRef.current?.pointerId !== event.pointerId)
      return
    resizeStateRef.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  const handleResizeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const maxHeight = getMaxOutputHeight()
    let nextHeight: number | null = null
    if (event.key === 'ArrowUp')
      nextHeight = outputHeight + (event.shiftKey ? OUTPUT_KEYBOARD_STEP * 2 : OUTPUT_KEYBOARD_STEP)
    else if (event.key === 'ArrowDown')
      nextHeight = outputHeight - (event.shiftKey ? OUTPUT_KEYBOARD_STEP * 2 : OUTPUT_KEYBOARD_STEP)
    else if (event.key === 'Home')
      nextHeight = MIN_OUTPUT_HEIGHT
    else if (event.key === 'End')
      nextHeight = maxHeight

    if (nextHeight === null)
      return
    event.preventDefault()
    onOutputHeightChange(clampOutputHeight(nextHeight, maxHeight))
  }

  const run = async () => {
    // Commit the buffer version before attaching a run to it. Otherwise the
    // normal debounce can publish the exact code already being run as a "new"
    // source version and incorrectly cancel that run moments later.
    flushPendingCode()
    const currentTab = useWorkspaceStore.getState().playgroundTabs.find(
      candidate => candidate.id === tab.id,
    )
    if (!currentTab)
      return
    const operationId = beginRun(tab.id, runOwnerEpoch)
    if (operationId === null)
      return
    const code = editorHandleRef.current?.getCode() ?? tab.initialCode
    const controller = new AbortController()
    const abortFromWorkspace = () => controller.abort(abortSignal.reason)
    runControllersRef.current.set(operationId, {
      controller,
      tabId: tab.id,
      contentVersion: currentTab.contentVersion,
    })
    if (abortSignal.aborted)
      abortFromWorkspace()
    else
      abortSignal.addEventListener('abort', abortFromWorkspace, { once: true })

    let result: RunResult | undefined
    try {
      result = await awaitWithSignal(
        runner.run(code, controller.signal),
        controller.signal,
      )
    }
    catch (error) {
      if (!controller.signal.aborted) {
        const message = error instanceof Error ? error.message : String(error)
        result = {
          ok: false,
          phase: null,
          stdout: '',
          stdoutTruncated: false,
          stderr: '',
          stderrTruncated: false,
          compilerOutput: '',
          compilerOutputTruncated: false,
          exitCode: null,
          failureKind: 'runner_unavailable',
          failureMessage: message,
        }
      }
    }
    finally {
      abortSignal.removeEventListener('abort', abortFromWorkspace)
      runControllersRef.current.delete(operationId)
      finishRun(tab.id, operationId, result)
    }
  }

  return (
    <div
      ref={paneRef}
      id={`playground-panel-${tab.id}`}
      role="tabpanel"
      aria-labelledby={`playground-tab-${tab.id}`}
      data-testid="playground-editor-pane"
      className="flex min-h-0 flex-1 flex-col"
    >
      <div
        ref={registerEditorSlot}
        data-testid="playground-editor"
        aria-label={t`Playground 代码编辑区`}
        onFocusCapture={activateEditor}
        onClick={activateEditor}
        className="flex min-h-0 flex-1"
      />

      <div
        data-testid="playground-output"
        className="relative flex shrink-0 flex-col border-t border-border bg-background"
        style={{ height: outputHeight }}
      >
        <div
          role="separator"
          aria-label={t`调整输出面板高度`}
          aria-orientation="horizontal"
          aria-valuemin={MIN_OUTPUT_HEIGHT}
          aria-valuemax={Math.round(getMaxOutputHeight())}
          aria-valuenow={Math.round(outputHeight)}
          aria-valuetext={`${Math.round(outputHeight)} px`}
          tabIndex={0}
          data-testid="playground-output-resizer"
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={stopResize}
          onPointerCancel={stopResize}
          onDoubleClick={() => onOutputHeightChange(DEFAULT_OUTPUT_HEIGHT)}
          onKeyDown={handleResizeKeyDown}
          className="group absolute inset-x-0 -top-1 z-10 h-2 cursor-row-resize touch-none outline-none"
        >
          <span className="absolute inset-x-0 top-1 h-px bg-border transition-colors group-hover:bg-primary/60 group-focus-visible:h-0.5 group-focus-visible:bg-primary" />
        </div>
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
          <span className="text-xs font-semibold text-muted-foreground"><Trans>运行结果</Trans></span>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-border overflow-hidden sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <section className="flex min-h-0 flex-col" aria-labelledby={`playground-program-output-${tab.id}`}>
            <h3
              id={`playground-program-output-${tab.id}`}
              className="h-8 shrink-0 border-b border-border/70 bg-muted/10 px-3 py-2 text-[11px] font-semibold text-muted-foreground"
            >
              <Trans>程序输出</Trans>
            </h3>
            <div className="min-h-0 flex-1 overflow-auto p-3">
              {tab.result
                ? (
                    <div className="space-y-2">
                      <pre
                        data-testid="playground-program-output"
                        className="whitespace-pre-wrap break-all font-mono text-xs leading-6 text-foreground"
                      >
                        {tab.result.stdout || (tab.result.phase === 'run'
                          ? i18n._(t`标准输出为空。`)
                          : i18n._(t`程序未运行。`))}
                      </pre>
                      {tab.result.stdoutTruncated && (
                        <p role="status" className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
                          <Trans>程序标准输出已截断。</Trans>
                        </p>
                      )}
                      {tab.result.stderr && (
                        <AnsiOutput
                          text={tab.result.stderr}
                          data-testid="playground-runtime-stderr"
                          className="whitespace-pre-wrap break-all font-mono text-xs leading-6 text-destructive"
                        />
                      )}
                      {tab.result.stderrTruncated && (
                        <p role="status" className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
                          <Trans>程序标准错误已截断。</Trans>
                        </p>
                      )}
                    </div>
                  )
                : <p className="text-xs text-muted-foreground"><Trans>运行后，程序输出会显示在这里。</Trans></p>}
            </div>
          </section>

          <section className="flex min-h-0 flex-col" aria-labelledby={`playground-compiler-output-${tab.id}`}>
            <h3
              id={`playground-compiler-output-${tab.id}`}
              className="h-8 shrink-0 border-b border-border/70 bg-muted/10 px-3 py-2 text-[11px] font-semibold text-muted-foreground"
            >
              <Trans>编译器输出</Trans>
            </h3>
            <div className="min-h-0 flex-1 overflow-auto p-3">
              {tab.result
                ? (
                    tab.result.phase !== 'compile'
                      ? (
                          <AnsiOutput
                            text={tab.result.phase === null
                              ? tab.result.failureMessage
                              : tab.result.compilerOutput.trim()
                                || i18n._(t`编译器未返回输出。`)}
                            data-testid="playground-compiler-output"
                            className="whitespace-pre-wrap break-all font-mono text-xs leading-6 text-foreground"
                          />
                        )
                      : (
                          <CompilerDiagnosticOutput
                            output={tab.result.compilerOutput}
                            testId="playground-stderr"
                          />
                        )
                  )
                : <p className="text-xs text-muted-foreground"><Trans>运行后，编译器输出会显示在这里。</Trans></p>}
              {tab.result?.compilerOutputTruncated && (
                <p role="status" className="mt-2 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
                  <Trans>编译器输出已截断。</Trans>
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
