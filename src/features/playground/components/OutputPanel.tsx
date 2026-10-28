'use client'

import { useState } from 'react'
import { CheckCircle2, CircleAlert, LoaderCircle, Terminal } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import { fontFamily } from '@/app/font'
import { AnsiOutput } from '@/components/AnsiOutput'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CompilerDiagnosticOutput } from '@/modules/cangjie-editor/components/CompilerDiagnosticOutput'
import { ProgramOutput } from '@/modules/cangjie-editor/components/ProgramOutput'
import { RunTruncationNotice } from '@/modules/cangjie-editor/components/RunTruncationNotice'
import type { RunnerTruncationState } from '@/lib/runner-contract'
import type { RunResult } from '@/lib/runner'

interface OutputPanelProps {
  toolOutput: string
  programOutput: string
  truncation: RunnerTruncationState
  result?: RunResult | null
  running?: boolean
}

export function OutputPanel({ toolOutput, programOutput, truncation, result = null, running = false }: OutputPanelProps) {
  const [selection, setSelection] = useState<{ result: RunResult | null, channel: string }>({ result: null, channel: 'program' })
  // A new outcome selects its relevant channel without taking focus from the editor.
  const channel = selection.result === result
    ? selection.channel
    : result?.phase === 'compile' || result?.phase === null ? 'compiler' : 'program'
  const empty = !result && !running && !toolOutput && !programOutput
  const style = { fontFamily }
  const exitCode = result?.exitCode
  const duration = result?.durationMs === undefined ? null : Math.round(result.durationMs)

  return (
    <Tabs id="panel-content" value={channel} onValueChange={next => setSelection({ result, channel: next })} className="min-h-0 flex-1 gap-0">
      <TabsList className="h-11 w-full shrink-0 justify-start rounded-none border-b border-border bg-background p-0">
        <TabsTrigger value="program" className="h-full flex-none rounded-none border-0 border-b-2 border-transparent px-3 text-muted-foreground data-[state=active]:border-tour-accent-fg data-[state=active]:text-tour-accent-fg data-[state=active]:shadow-none">
          <Trans>程序输出</Trans>
        </TabsTrigger>
        <TabsTrigger value="compiler" className="h-full flex-none rounded-none border-0 border-b-2 border-transparent px-3 text-muted-foreground data-[state=active]:border-tour-accent-fg data-[state=active]:text-tour-accent-fg data-[state=active]:shadow-none">
          <Trans>编译信息</Trans>
          {result?.phase === 'compile' && <CircleAlert aria-hidden="true" className="size-4 text-destructive" />}
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
                  ? <p role="status" className="text-sm text-muted-foreground"><Trans>正在运行...</Trans></p>
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
                  {result?.phase === null
                    ? <p className="text-sm text-error-foreground"><Trans>代码运行服务暂时不可用，请稍后重试。</Trans></p>
                    : result && !result.compilerOutput.trim()
                      ? <p className="text-sm text-muted-foreground"><Trans>编译器未返回输出。</Trans></p>
                      : <CompilerDiagnosticOutput output={result?.compilerOutput ?? toolOutput} variant="plain" style={style} />}
                  {(result?.compilerOutputTruncated ?? truncation.compilerOutput) && <RunTruncationNotice stream="compiler" />}
                </div>
              </TabsContent>
            </>
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
                    <CheckCircle2 aria-hidden="true" className="size-3.5 text-tour-accent-fg" />
                    <Trans>运行完成</Trans>
                  </>
                )
              : (
                  <>
                    <CircleAlert aria-hidden="true" className="size-3.5 text-destructive" />
                    {result?.phase === 'compile' ? <Trans>编译失败</Trans> : <Trans>运行失败</Trans>}
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
