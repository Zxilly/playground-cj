'use client'

import { useClassroomLiveScrollSurface } from '@/features/tour-ai/context/classroom-live-scroll-surface'

export interface ScrollFollowerState {
  pinned: boolean
  newContentBelow: boolean
  visible: boolean
  scrollToBottom: () => void
}

export function useScrollFollower(): ScrollFollowerState {
  return useClassroomLiveScrollSurface().follower
}
