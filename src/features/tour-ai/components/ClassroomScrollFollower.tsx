'use client'

import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { useScrollFollower } from '@/features/tour-ai/components/use-scroll-follower'

interface Props {
  visible?: boolean
  onClick?: () => void
}

export function ClassroomScrollFollower(props: Props = {}) {
  if (props.visible !== undefined && props.onClick)
    return <ClassroomScrollFollowerButton visible={props.visible} onClick={props.onClick} />

  return <ClassroomScrollFollowerAdapter />
}

function ClassroomScrollFollowerAdapter() {
  const follower = useScrollFollower()
  return <ClassroomScrollFollowerButton visible={follower.visible} onClick={follower.scrollToBottom} />
}

function ClassroomScrollFollowerButton({ visible, onClick }: Required<Props>) {
  const descriptionId = useId()
  const [announcementCount, setAnnouncementCount] = useState(0)

  const handleClick = () => {
    onClick()
    setAnnouncementCount(count => count + 1)
  }

  return (
    <>
      {visible && (
        <button
          type="button"
          aria-label={t`滚动到最新内容`}
          aria-describedby={descriptionId}
          onClick={handleClick}
          // bottom-20 keeps the pill above the sticky ClassroomIntentBar
          // (~48px tall, anchored at bottom-3) so the two surfaces don't collide.
          // z-20 puts it above the rail so an accidental click on a marker
          // doesn't intercept the pill.
          className="absolute bottom-20 right-4 z-20 inline-flex max-w-[calc(100%-2rem)] items-center gap-1.5 rounded-full border border-tour-border bg-tour-surface px-3 py-1.5 text-xs font-medium text-tour-accent-fg shadow-md hover:bg-tour-bg sm:right-6"
        >
          <ChevronDown aria-hidden="true" className="size-3.5" />
          <Trans>新内容</Trans>
          <span id={descriptionId} className="sr-only">
            <Trans>跳到课堂流底部查看新生成内容，不会改变学习进度。</Trans>
          </span>
        </button>
      )}
      {announcementCount > 0 && (
        <span
          key={announcementCount}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-testid="classroom-scroll-follower-status"
          className="sr-only"
        >
          <Trans>已跳到最新课堂内容。</Trans>
        </span>
      )}
    </>
  )
}
