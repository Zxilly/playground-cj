import { Trans } from '@lingui/react/macro'

export function ClassroomBrandChip() {
  return (
    <>
      <div className="flex size-6 items-center justify-center rounded-md bg-tour-accent-fg font-mono text-xs font-bold text-white">仓</div>
      <div className="truncate text-sm font-semibold text-tour-text"><Trans>AI 课堂</Trans></div>
    </>
  )
}
