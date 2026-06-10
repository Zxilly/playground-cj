import { BranchPickerPrimitive } from '@assistant-ui/react'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { t } from '@lingui/core/macro'
import type { FC } from 'react'
import { cn } from '@/lib/utils'
import { TooltipIconButton } from '@/modules/assistant-ui/registry/TooltipIconButton'

export const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({
  className,
  ...rest
}) => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={cn(
        'aui-branch-picker-root -ms-2 me-2 inline-flex items-center text-muted-foreground text-xs',
        className,
      )}
      {...rest}
    >
      <BranchPickerPrimitive.Previous asChild>
        <TooltipIconButton tooltip={t`上一条回复`}>
          <ChevronLeftIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Previous>
      <span className="aui-branch-picker-state font-medium">
        <BranchPickerPrimitive.Number />
        {' '}
        /
        <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <TooltipIconButton tooltip={t`下一条回复`}>
          <ChevronRightIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  )
}
