'use client'

import type { CSSProperties } from 'react'
import { Trans } from '@lingui/react/macro'
import { AnsiOutput } from '@/components/AnsiOutput'
import { formatCompilerOutput } from '@/lib/compiler-output'
import { cn } from '@/lib/utils'

interface CompilerDiagnosticOutputProps {
  output: string
  testId?: string
  variant?: 'error' | 'plain'
  style?: CSSProperties
}

/** Keep actionable diagnostics visible and retain the raw runner log on demand. */
export function CompilerDiagnosticOutput({ output, testId, variant = 'error', style }: CompilerDiagnosticOutputProps) {
  const formatted = formatCompilerOutput(output)
  return (
    <div className="space-y-2">
      <AnsiOutput
        text={formatted.diagnosticAnsi}
        data-testid={testId}
        style={style}
        className={cn('whitespace-pre-wrap break-all font-mono leading-relaxed', variant === 'error'
          ? 'max-h-48 overflow-auto rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-error-foreground'
          : 'text-sm text-foreground')}
      />
      {formatted.hasHiddenPreamble && (
        <details data-testid={testId ? `${testId}-raw` : undefined} className="rounded-md border border-border/60 bg-muted/20 text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none px-3 py-2 font-medium">
            <Trans>查看原始编译信息</Trans>
          </summary>
          <AnsiOutput text={formatted.fullAnsi} style={style} className="max-h-40 overflow-auto whitespace-pre-wrap break-all border-t border-border/60 px-3 py-2 font-mono leading-relaxed" />
        </details>
      )}
    </div>
  )
}
