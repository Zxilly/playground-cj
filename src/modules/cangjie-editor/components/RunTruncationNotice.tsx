'use client'

import { Trans } from '@lingui/react/macro'

export function RunTruncationNotice({ stream }: { stream: 'compiler' | 'stdout' | 'stderr' }) {
  return (
    <p role="status" className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-200">
      {stream === 'compiler'
        ? <Trans>编译器输出已截断。</Trans>
        : stream === 'stdout'
          ? <Trans>程序标准输出已截断。</Trans>
          : <Trans>程序标准错误已截断。</Trans>}
    </p>
  )
}
