'use client'

import { fontFamily } from '@/app/font'
import LabelContainer from '@/features/playground/components/LabelContainer'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { AnsiOutput } from '@/components/AnsiOutput'
import { formatCompilerOutput } from '@/lib/compiler-output'

interface OutputPanelProps {
  toolOutput: string
  programOutput: string
}

export function OutputPanel({ toolOutput, programOutput }: OutputPanelProps) {
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
          </div>
        )}
        className="flex-1/2 mb-1 lg:mb-2"
      />
      <LabelContainer
        title={i18n._(msg`程序输出`)}
        content={(
          <AnsiOutput
            text={programOutput}
            className="whitespace-pre min-h-0 min-w-0"
            style={{ fontFamily }}
          />
        )}
        className="flex-1/2 mt-1 lg:mt-2"
      />
    </div>
  )
}
