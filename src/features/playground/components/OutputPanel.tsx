'use client'

import { fontFamily } from '@/app/font'
import LabelContainer from '@/features/playground/components/LabelContainer'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { AnsiOutput } from '@/components/AnsiOutput'
import { formatCompilerOutput } from '@/lib/compiler-output'
import type { RunnerTruncationState } from '@/lib/runner-contract'

interface OutputPanelProps {
  toolOutput: string
  programOutput: string
  truncation: RunnerTruncationState
}

function TruncationNotice({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
      {children}
    </p>
  )
}

export function OutputPanel({ toolOutput, programOutput, truncation }: OutputPanelProps) {
  const { i18n } = useLingui()
  const compiler = formatCompilerOutput(toolOutput)

  return (
    <div
      id="panel-content"
      className="flex-1 overflow-hidden flex flex-col"
    >
      <LabelContainer
        title={i18n._(msg`编译信息`)}
        content={(
          <div className="min-h-0 min-w-0 space-y-2">
            <AnsiOutput
              text={compiler.diagnosticAnsi}
              className="whitespace-pre-wrap break-all"
              style={{ fontFamily }}
            />
            {compiler.hasHiddenPreamble && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer select-none py-1 font-medium">
                  <Trans>查看原始编译信息</Trans>
                </summary>
                <AnsiOutput
                  text={compiler.fullAnsi}
                  className="mt-1 whitespace-pre-wrap break-all border-t border-border/60 pt-2"
                  style={{ fontFamily }}
                />
              </details>
            )}
            {truncation.compilerOutput && (
              <TruncationNotice><Trans>编译器输出已截断。</Trans></TruncationNotice>
            )}
            {truncation.formatterOutput && (
              <TruncationNotice><Trans>格式化器输出已截断。</Trans></TruncationNotice>
            )}
            {truncation.formattedSource && (
              <TruncationNotice><Trans>格式化结果已截断；编辑器内容未更改。</Trans></TruncationNotice>
            )}
          </div>
        )}
        className="flex-1/2 mb-1 lg:mb-2"
      />
      <LabelContainer
        title={i18n._(msg`程序输出`)}
        content={(
          <div className="min-h-0 min-w-0 space-y-2">
            <AnsiOutput
              text={programOutput}
              className="whitespace-pre"
              style={{ fontFamily }}
            />
            {truncation.programStdout && (
              <TruncationNotice><Trans>程序标准输出已截断。</Trans></TruncationNotice>
            )}
            {truncation.programStderr && (
              <TruncationNotice><Trans>程序标准错误已截断。</Trans></TruncationNotice>
            )}
          </div>
        )}
        className="flex-1/2 mt-1 lg:mt-2"
      />
    </div>
  )
}
