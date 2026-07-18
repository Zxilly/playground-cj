'use client'

import { Trans } from '@lingui/react/macro'
import { AnsiOutput } from '@/components/AnsiOutput'
import { formatCompilerOutput } from '@/lib/teach/feedback/compiler-output'

interface CompilerDiagnosticOutputProps {
  output: string
  testId: string
}

/**
 * Shared student-facing compiler failure view. The actual diagnostic owns the
 * visual hierarchy; runner commands and compiler banners remain available only
 * in a collapsed disclosure for debugging.
 */
export function CompilerDiagnosticOutput({ output, testId }: CompilerDiagnosticOutputProps) {
  const formatted = formatCompilerOutput(output)

  return (
    <div className="space-y-2">
      <AnsiOutput
        text={formatted.diagnosticAnsi}
        data-testid={testId}
        className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 font-mono text-xs leading-relaxed text-destructive"
      />
      {formatted.hasHiddenPreamble && (
        <details
          data-testid={`${testId}-raw`}
          className="rounded-md border border-border/60 bg-muted/20 text-xs text-muted-foreground"
        >
          <summary className="cursor-pointer select-none px-3 py-2 font-medium">
            <Trans>查看原始编译信息</Trans>
          </summary>
          <AnsiOutput
            text={formatted.fullAnsi}
            className="max-h-40 overflow-auto whitespace-pre-wrap break-all border-t border-border/60 px-3 py-2 font-mono leading-relaxed"
          />
        </details>
      )}
    </div>
  )
}
