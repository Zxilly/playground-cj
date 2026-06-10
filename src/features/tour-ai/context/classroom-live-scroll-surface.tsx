'use client'

import { createContext, use, useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import { useClassroomSession } from '@/features/tour-ai/context/classroom-session-context'
import { useClassroomVirtuosoRef } from '@/features/tour-ai/context/classroom-virtuoso-context'
import { useScrollWatermarkStore } from '@/features/tour-ai/state/scroll-watermark-store'
import { deriveScrollRailMarkersForSurface } from '@/features/tour-ai/utils/scroll-rail-markers'
import type { ScrollRailMarker } from '@/features/tour-ai/utils/scroll-rail-markers'
import {
  deriveLiveScrollWatermarkIndex,
  focusLatestLiveStreamItem,
  focusLiveChapterAnchor,
  focusLiveExerciseAnchor,
  isPinnedToLiveScrollBottom,
  measureLiveScrollViewport,
  restoreLiveScrollPosition,
  scrollLiveViewportToBlockKey,
  scrollLiveViewportToBottom,
  scrollLiveViewportToExerciseId,
  scrollLiveViewportToMarker,
} from '@/features/tour-ai/context/classroom-live-scroll-surface-model'
import type { LiveScrollLens } from '@/features/tour-ai/context/classroom-live-scroll-surface-model'
import { projectClassroomLiveViewSurface } from '@/lib/ai/classroom/view-projections'
import type { ClassroomChapterIndexEntry, ClassroomLiveViewSurface } from '@/lib/ai/classroom/view-projections'

interface LiveScrollSurfaceState {
  lens: LiveScrollLens | null
  pinned: boolean
  newContentBelow: boolean
}

type LiveScrollSurfaceAction
  = | { type: 'MEASURED', lens: LiveScrollLens, pinned: boolean }
    | { type: 'SET_NEW_CONTENT_BELOW', visible: boolean }
    | { type: 'CLEAR_NEW_CONTENT_BELOW' }

interface LiveScrollFollowerState {
  pinned: boolean
  newContentBelow: boolean
  visible: boolean
  scrollToBottom: () => void
}

export interface ClassroomLiveScrollSurface {
  viewportRef: RefObject<HTMLDivElement | null>
  surface: ClassroomLiveViewSurface
  markers: ScrollRailMarker[]
  chapterEntries: ClassroomChapterIndexEntry[]
  visibleCount: number
  watermarkIndex: number
  lens: LiveScrollLens | null
  follower: LiveScrollFollowerState
  jumpToMarker: (marker: ScrollRailMarker) => void
  scrollToBlockKey: (blockKey: string) => void
  scrollToExerciseId: (exerciseId: string) => void
}

interface ClassroomLiveScrollSurfaceProviderProps {
  viewportRef: RefObject<HTMLDivElement | null>
  lang: string
  hydrated: boolean
  children: ReactNode
}

const ClassroomLiveScrollSurfaceContext = createContext<ClassroomLiveScrollSurface | null>(null)

function sameLens(a: LiveScrollLens | null, b: LiveScrollLens): boolean {
  return a != null && a.top === b.top && a.height === b.height
}

function liveScrollSurfaceReducer(
  state: LiveScrollSurfaceState,
  action: LiveScrollSurfaceAction,
): LiveScrollSurfaceState {
  if (action.type === 'MEASURED') {
    const nextNewContentBelow = action.pinned ? false : state.newContentBelow
    if (
      state.pinned === action.pinned
      && state.newContentBelow === nextNewContentBelow
      && sameLens(state.lens, action.lens)
    ) {
      return state
    }
    return {
      lens: action.lens,
      pinned: action.pinned,
      newContentBelow: nextNewContentBelow,
    }
  }

  if (action.type === 'CLEAR_NEW_CONTENT_BELOW') {
    if (!state.newContentBelow)
      return state
    return { ...state, newContentBelow: false }
  }

  const nextVisible = state.pinned ? false : action.visible
  if (state.newContentBelow === nextVisible)
    return state
  return { ...state, newContentBelow: nextVisible }
}

export function ClassroomLiveScrollSurfaceProvider({
  viewportRef,
  lang,
  hydrated,
  children,
}: ClassroomLiveScrollSurfaceProviderProps) {
  const { session } = useClassroomSession()
  const virtuosoRef = useClassroomVirtuosoRef()
  const surface = useMemo(() => projectClassroomLiveViewSurface(session), [session])
  const markers = useMemo(() => deriveScrollRailMarkersForSurface(session, surface), [session, surface])
  const visibleCount = surface.visibleCount
  const watermarkIndex = useScrollWatermarkStore(s => s.watermarks[lang] ?? -1)
  const setWatermark = useScrollWatermarkStore(s => s.setWatermark)
  const [state, dispatchLiveScroll] = useReducer(liveScrollSurfaceReducer, {
    lens: null,
    pinned: true,
    newContentBelow: false,
  })

  const surfaceRef = useRef(surface)
  const hydratedRef = useRef(hydrated)
  const visibleCountRef = useRef(visibleCount)
  const watermarkIndexRef = useRef(watermarkIndex)
  surfaceRef.current = surface
  hydratedRef.current = hydrated
  visibleCountRef.current = visibleCount
  watermarkIndexRef.current = watermarkIndex

  const measureAndCommit = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport)
      return null

    const measurement = measureLiveScrollViewport(viewport)
    const lens = {
      top: measurement.lensTopPct * 100,
      height: measurement.lensHeightPct * 100,
    }
    dispatchLiveScroll({
      type: 'MEASURED',
      lens,
      pinned: isPinnedToLiveScrollBottom(measurement),
    })

    const reachedIndex = deriveLiveScrollWatermarkIndex(measurement, visibleCountRef.current)
    if (
      hydratedRef.current
      && reachedIndex != null
      && reachedIndex > watermarkIndexRef.current
    ) {
      setWatermark(lang, reachedIndex)
    }

    return measurement
  }, [lang, setWatermark, viewportRef])

  const didRestoreRef = useRef(false)
  useEffect(() => {
    if (didRestoreRef.current)
      return
    if (!hydrated)
      return
    const viewport = viewportRef.current
    if (!viewport)
      return

    didRestoreRef.current = true
    const watermark = useScrollWatermarkStore.getState().watermarks[lang] ?? -1
    restoreLiveScrollPosition({
      viewport,
      virtuoso: virtuosoRef?.current ?? null,
      surface: surfaceRef.current,
      watermarkIndex: watermark,
      activeExerciseId: session.currentExercise?.status === 'active' ? session.currentExercise.id : null,
    })
    measureAndCommit()
  }, [hydrated, lang, measureAndCommit, session.currentExercise?.id, session.currentExercise?.status, viewportRef, virtuosoRef])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport)
      return

    const onScroll = () => measureAndCommit()
    viewport.addEventListener('scroll', onScroll, { passive: true })
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => measureAndCommit())
      : null
    resizeObserver?.observe(viewport)
    measureAndCommit()

    return () => {
      viewport.removeEventListener('scroll', onScroll)
      resizeObserver?.disconnect()
    }
  }, [measureAndCommit, viewportRef])

  const lastStreamLengthRef = useRef<number | null>(null)
  useEffect(() => {
    if (!hydrated)
      return
    const viewport = viewportRef.current
    if (!viewport)
      return

    const previous = lastStreamLengthRef.current
    lastStreamLengthRef.current = session.stream.length
    if (previous === null)
      return

    if (session.stream.length > previous) {
      if (state.pinned) {
        viewport.scrollTop = viewport.scrollHeight
        measureAndCommit()
      }
      else {
        dispatchLiveScroll({ type: 'SET_NEW_CONTENT_BELOW', visible: true })
      }
    }
  }, [hydrated, measureAndCommit, session.stream.length, state.pinned, viewportRef])

  const scrollToBottom = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport)
      return
    scrollLiveViewportToBottom({
      viewport,
      virtuoso: virtuosoRef?.current ?? null,
      visibleCount: surfaceRef.current.visibleCount,
    })
    dispatchLiveScroll({ type: 'CLEAR_NEW_CONTENT_BELOW' })
    window.requestAnimationFrame(() => {
      if (focusLatestLiveStreamItem(viewport))
        return
      window.requestAnimationFrame(() => {
        focusLatestLiveStreamItem(viewport)
      })
    })
  }, [viewportRef, virtuosoRef])

  const jumpToMarker = useCallback((marker: ScrollRailMarker) => {
    const viewport = viewportRef.current
    if (!viewport)
      return
    scrollLiveViewportToMarker({
      viewport,
      virtuoso: virtuosoRef?.current ?? null,
      surface: surfaceRef.current,
      marker,
    })
  }, [viewportRef, virtuosoRef])

  const scrollToBlockKey = useCallback((blockKey: string) => {
    const viewport = viewportRef.current
    if (!viewport)
      return
    const didScroll = scrollLiveViewportToBlockKey({
      viewport,
      virtuoso: virtuosoRef?.current ?? null,
      surface: surfaceRef.current,
      blockKey,
    })
    if (didScroll) {
      window.requestAnimationFrame(() => {
        focusLiveChapterAnchor(viewport, blockKey)
      })
    }
  }, [viewportRef, virtuosoRef])

  const scrollToExerciseId = useCallback((exerciseId: string) => {
    const viewport = viewportRef.current
    if (!viewport)
      return
    scrollLiveViewportToExerciseId({
      viewport,
      virtuoso: virtuosoRef?.current ?? null,
      surface: surfaceRef.current,
      exerciseId,
      focus: true,
    })
    window.requestAnimationFrame(() => {
      if (focusLiveExerciseAnchor(viewport, exerciseId))
        return
      window.requestAnimationFrame(() => {
        focusLiveExerciseAnchor(viewport, exerciseId)
      })
    })
  }, [viewportRef, virtuosoRef])

  const value = useMemo<ClassroomLiveScrollSurface>(() => ({
    viewportRef,
    surface,
    markers,
    chapterEntries: surface.chapterEntries,
    visibleCount,
    watermarkIndex,
    lens: state.lens,
    follower: {
      pinned: state.pinned,
      newContentBelow: state.newContentBelow,
      visible: state.newContentBelow && !state.pinned,
      scrollToBottom,
    },
    jumpToMarker,
    scrollToBlockKey,
    scrollToExerciseId,
  }), [
    jumpToMarker,
    markers,
    scrollToBlockKey,
    scrollToBottom,
    scrollToExerciseId,
    surface,
    state.lens,
    state.newContentBelow,
    state.pinned,
    viewportRef,
    visibleCount,
    watermarkIndex,
  ])

  return (
    <ClassroomLiveScrollSurfaceContext value={value}>
      {children}
    </ClassroomLiveScrollSurfaceContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useClassroomLiveScrollSurface(): ClassroomLiveScrollSurface {
  const ctx = use(ClassroomLiveScrollSurfaceContext)
  if (!ctx)
    throw new Error('useClassroomLiveScrollSurface must be used inside ClassroomLiveScrollSurfaceProvider')
  return ctx
}
