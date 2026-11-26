'use client'

import { useState } from 'react'
import { CheckCircle2, ChevronDown, CircleAlert, LoaderCircle, Square, Terminal, X } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { fontFamily } from '@/app/font'
import { AnsiOutput } from '@/components/AnsiOutput'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CompilerDiagnosticOutput } from '@/modules/cangjie-editor/components/CompilerDiagnosticOutput'
import { ProgramOutput } from '@/modules/cangjie-editor/components/ProgramOutput'
import { RunTruncationNotice } from '@/modules/cangjie-editor/components/RunTruncationNotice'
import type { RunnerTruncationState } from '@/lib/runner-contract'
import type { RunResult } from '@/lib/runner'
import { formatLocalizedRunFailure } from '@/service/run'

interface OutputPanelProps {
  toolOutput: string
  programOutput: string
  truncation: RunnerTruncationState
  result?: RunResult | null
  running?: boolean
  onCancelRun?: () => void
  stdin?: string
  onStdinChange?: (value: string) => void
}

export function OutputPanel({
  toolOutput,
  programOutput,
  truncation,
  result = null,
  running = false,
  onCancelRun,
  stdin = '',
  onStdinChange,
}: OutputPanelProps) {
  const { i18n } = useLingui()
  const [selection, setSelection] = useState<{ result: RunResult | null, channel: string }>({ result: null, channel: 'program' })
  const [stdinOpen, setStdinOpen] = useState(false)
  // A new outcome selects its relevant channel without taking focus from the editor.
  const channel = selection.result === result
    ? selection.channel
    : result?.phase === 'compile' || result?.phase === null ? 'compiler' : 'program'
  const empty = !result && !running && !toolOutput && !programOutput
  const style = { fontFamily }
  const exitCode = result?.exitCode
  const duration = result?.durationMs === undefined ? null : Math.round(result.durationMs)
  const failureSummary = result?.phase === null ? formatLocalizedRunFailure(result) : null

  return (
    <Tabs id="panel-content" value={channel} onValueChange={next => setSelection({ result, channel: next })} className="min-h-0 flex-1 gap-0">
      <TabsList className="h-11 w-full shrink-0 justify-start rounded-none border-b border-border bg-background p-0">
        <TabsTrigger value="program" className="h-full flex-none rounded-none border-0 border-b-2 border-transparent px-3 text-muted-foreground data-[state=active]:border-brand data-[state=active]:text-brand data-[state=active]:shadow-none">
          <Trans>程序输出</Trans>
        </TabsTrigger>
        <TabsTrigger value="compiler" className="h-full flex-none rounded-none border-0 border-b-2 border-transparent px-3 text-muted-foreground data-[state=active]:border-brand data-[state=active]:text-brand data-[state=active]:shadow-none">
          <Trans>编译信息</Trans>
          {(result?.phase === 'compile' || result?.phase === null) && (
            <CircleAlert aria-hidden="true" className="size-4 text-error-foreground" />
          )}
        </TabsTrigger>
      </TabsList>
      {empty
        ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-muted/20 px-4 text-center">
              <Terminal aria-hidden="true" className="size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground"><Trans>运行代码后，结果会显示在这里</Trans></p>
              <kbd className="rounded border border-border bg-background px-2 py-1 text-xs text-muted-foreground">Ctrl / ⌘ + B</kbd>
            </div>
          )
        : (
            <>
              <TabsContent value="program" className="min-h-0 overflow-auto bg-muted/20 p-4">
                {running
                  ? (
                      <div role="status" className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-2">
                          <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
                          <Trans>正在运行...</Trans>
                        </span>
                        {onCancelRun && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={onCancelRun}
                            className="h-8 gap-1.5 text-xs text-error-foreground hover:text-error-foreground"
                          >
                            <Square aria-hidden="true" className="size-3 fill-current" />
                            <Trans>取消运行</Trans>
                          </Button>
                        )}
                      </div>
                    )
                  : result
                    ? <ProgramOutput result={result} className="whitespace-pre font-mono text-sm leading-relaxed" style={style} />
                    : (
                        <div className="space-y-2">
                          <AnsiOutput text={programOutput} className="whitespace-pre text-sm" style={style} />
                          {truncation.programStdout && <RunTruncationNotice stream="stdout" />}
                          {truncation.programStderr && <RunTruncationNotice stream="stderr" />}
                        </div>
                      )}
              </TabsContent>
              <TabsContent value="compiler" className="min-h-0 overflow-auto bg-muted/20 p-4">
                <div className="space-y-2">
                  {failureSummary !== null
                    ? (
                        <div role="alert" className="rounded-md border border-error-foreground/30 bg-error-foreground/5 p-3 text-sm text-error-foreground">
                          <p className="font-medium">{failureSummary}</p>
                        </div>
                      )
                    : result && !result.compilerOutput.trim()
                      ? <p className="text-sm text-muted-foreground"><Trans>编译器未返回输出。</Trans></p>
                      : <CompilerDiagnosticOutput output={result?.compilerOutput ?? toolOutput} variant="plain" style={style} />}
                  {(result?.compilerOutputTruncated ?? truncation.compilerOutput) && <RunTruncationNotice stream="compiler" />}
                </div>
              </TabsContent>
            </>
          )}
      {onStdinChange && (
        <div className="shrink-0 border-t border-border bg-background">
          <div className="flex items-center justify-between px-3 py-1.5">
            <button
              type="button"
              aria-expanded={stdinOpen}
              aria-controls="playground-stdin-input"
              onClick={() => setStdinOpen(open => !open)}
              className="inline-flex min-h-8 items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronDown
                aria-hidden="true"
                className={`size-3.5 transition-transform duration-150 motion-reduce:transition-none ${stdinOpen ? 'rotate-0' : '-rotate-90'}`}
              />
              <Trans>标准输入 (stdin)</Trans>
              {stdin.length > 0 && (
                <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand">
                  <Trans>已填写</Trans>
                </span>
              )}
            </button>
            {stdin.length > 0 && (
              <button
                type="button"
                aria-label={i18n._(msg`清空标准输入`)}
                onClick={() => onStdinChange('')}
                className="inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            )}
          </div>
          {stdinOpen && (
            <div className="px-3 pb-2.5">
              <textarea
                id="playground-stdin-input"
                value={stdin}
                onChange={event => onStdinChange(event.target.value)}
                rows={3}
                spellCheck={false}
                placeholder={i18n._(msg`在此输入程序运行时从 stdin 读取的内容…`)}
                aria-label={i18n._(msg`标准输入`)}
                style={style}
                className="w-full resize-y rounded-md border border-input bg-muted/40 p-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          )}
        </div>
      )}
      {(running || result) && (
        <div role="status" aria-live="polite" className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
          {running
            ? (
                <>
                  <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin motion-reduce:animate-none" />
                  <Trans>运行中</Trans>
                </>
              )
            : result?.ok
              ? (
                  <>
                    <CheckCircle2 aria-hidden="true" className="size-3.5 text-brand" />
                    <Trans>运行完成</Trans>
                  </>
                )
              : (
                  <>
                    <CircleAlert aria-hidden="true" className="size-3.5 text-error-foreground" />
                    {result?.phase === 'compile'
                      ? <Trans>编译失败</Trans>
                      : result?.phase === null
                        ? <Trans>服务异常</Trans>
                        : <Trans>运行失败</Trans>}
                  </>
                )}
          {!running && exitCode !== null && exitCode !== undefined && (
            <span>
              <Trans>
                退出码
                {exitCode}
              </Trans>
            </span>
          )}
          {!running && duration !== null && (
            <span className="ml-auto tabular-nums">
              <Trans>
                总耗时
                {duration}
                {' '}
                ms
              </Trans>
            </span>
          )}
        </div>
      )}
    </Tabs>
  )
}
