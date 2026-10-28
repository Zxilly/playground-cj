'use client'

import type { CSSProperties } from 'react'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { AnsiOutput } from '@/components/AnsiOutput'
import type { RunResult } from '@/lib/runner'
import { RunTruncationNotice } from './RunTruncationNotice'

interface ProgramOutputProps {
  result: RunResult
  testId?: string
  stderrTestId?: string
  className?: string
  style?: CSSProperties
}

export function ProgramOutput({ result, testId, stderrTestId, className = 'whitespace-pre-wrap break-all font-mono text-xs leading-6', style }: ProgramOutputProps) {
  const { i18n } = useLingui()
  return (
    <div className="space-y-2">
      <AnsiOutput
        text={result.stdout || (result.phase === 'run' ? i18n._(msg`标准输出为空。`) : i18n._(msg`程序未运行。`))}
        data-testid={testId}
        className={className}
        style={style}
      />
      {result.stdoutTruncated && <RunTruncationNotice stream="stdout" />}
      {result.stderr && <AnsiOutput text={result.stderr} data-testid={stderrTestId} className={`${className} text-error-foreground`} style={style} />}
      {result.stderrTruncated && <RunTruncationNotice stream="stderr" />}
    </div>
  )
}
