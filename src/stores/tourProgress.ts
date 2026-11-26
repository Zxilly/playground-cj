'use client'

import { create } from 'zustand'

export const TOUR_DRAFTS_STORAGE_KEY = 'cj-tour:drafts:v1'
export const TOUR_PROGRESS_STORAGE_KEY = 'cj-tour:progress:v1'

export interface TourLastVisited {
  readonly sectionKey: string
  readonly chapterId: string
  readonly subChapterId: string
  readonly sectionId: string
  readonly chapterSlug: string
  readonly chapterStep: string
  readonly title?: Record<string, string>
}

interface StoredProgressPayload {
  visitedSections?: Record<string, true>
  lastVisited?: TourLastVisited | null
}

function readJsonFromStorage<T>(key: string): T | null {
  if (typeof window === 'undefined')
    return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw)
      return null
    return JSON.parse(raw) as T
  }
  catch {
    return null
  }
}

function writeJsonToStorage(key: string, value: unknown): boolean {
  if (typeof window === 'undefined')
    return false
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  }
  catch {
    return false
  }
}

function sanitizeDrafts(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return {}
  const result: Record<string, string> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof key === 'string' && typeof item === 'string')
      result[key] = item
  }
  return result
}

function sanitizeVisited(value: unknown): Record<string, true> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return {}
  const result: Record<string, true> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof key === 'string' && item === true)
      result[key] = true
  }
  return result
}

function sanitizeLastVisited(value: unknown): TourLastVisited | null {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return null
  const record = value as Record<string, unknown>
  if (
    typeof record.sectionKey !== 'string'
    || typeof record.chapterId !== 'string'
    || typeof record.subChapterId !== 'string'
    || typeof record.sectionId !== 'string'
    || typeof record.chapterSlug !== 'string'
    || typeof record.chapterStep !== 'string'
  ) {
    return null
  }
  const title = record.title && typeof record.title === 'object' && !Array.isArray(record.title)
    ? Object.fromEntries(
        Object.entries(record.title as Record<string, unknown>)
          .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
      )
    : undefined
  return {
    sectionKey: record.sectionKey,
    chapterId: record.chapterId,
    subChapterId: record.subChapterId,
    sectionId: record.sectionId,
    chapterSlug: record.chapterSlug,
    chapterStep: record.chapterStep,
    ...(title ? { title } : {}),
  }
}

export function buildTourSectionKey(chapterId: string, subChapterId: string, sectionId: string): string {
  return `${chapterId}/${subChapterId}/${sectionId}`
}

interface TourProgressState {
  readonly hydrated: boolean
  readonly drafts: Readonly<Record<string, string>>
  readonly visitedSections: Readonly<Record<string, true>>
  readonly lastVisited: TourLastVisited | null

  readonly hydrate: () => {
    drafts: Readonly<Record<string, string>>
    visitedSections: Readonly<Record<string, true>>
    lastVisited: TourLastVisited | null
  }
  readonly saveDraft: (sectionKey: string, code: string, starterCode?: string) => boolean
  readonly clearDraft: (sectionKey: string) => void
  readonly markVisited: (entry: TourLastVisited) => void
}

export const useTourProgressStore = create<TourProgressState>((set, get) => ({
  hydrated: false,
  drafts: {},
  visitedSections: {},
  lastVisited: null,

  hydrate: () => {
    const current = get()
    if (current.hydrated) {
      return {
        drafts: current.drafts,
        visitedSections: current.visitedSections,
        lastVisited: current.lastVisited,
      }
    }
    const drafts = sanitizeDrafts(readJsonFromStorage<unknown>(TOUR_DRAFTS_STORAGE_KEY))
    const progress = readJsonFromStorage<StoredProgressPayload>(TOUR_PROGRESS_STORAGE_KEY)
    const visitedSections = sanitizeVisited(progress?.visitedSections)
    const lastVisited = sanitizeLastVisited(progress?.lastVisited)
    set({ hydrated: true, drafts, visitedSections, lastVisited })
    return { drafts, visitedSections, lastVisited }
  },

  saveDraft: (sectionKey, code, starterCode) => {
    if (!sectionKey)
      return false
    const current = get().drafts
    if (starterCode !== undefined && code === starterCode) {
      if (!(sectionKey in current))
        return true
      const next = { ...current }
      delete next[sectionKey]
      set({ drafts: next })
      return writeJsonToStorage(TOUR_DRAFTS_STORAGE_KEY, next)
    }
    if (current[sectionKey] === code)
      return true
    const next = { ...current, [sectionKey]: code }
    set({ drafts: next })
    return writeJsonToStorage(TOUR_DRAFTS_STORAGE_KEY, next)
  },

  clearDraft: (sectionKey) => {
    const current = get().drafts
    if (!(sectionKey in current))
      return
    const next = { ...current }
    delete next[sectionKey]
    set({ drafts: next })
    writeJsonToStorage(TOUR_DRAFTS_STORAGE_KEY, next)
  },

  markVisited: (entry) => {
    const state = get()
    const alreadyVisited = state.visitedSections[entry.sectionKey] === true
    const sameLast = state.lastVisited?.sectionKey === entry.sectionKey
    if (alreadyVisited && sameLast)
      return
    const visitedSections = alreadyVisited
      ? state.visitedSections
      : { ...state.visitedSections, [entry.sectionKey]: true as const }
    set({ visitedSections, lastVisited: entry })
    writeJsonToStorage(TOUR_PROGRESS_STORAGE_KEY, {
      visitedSections,
      lastVisited: entry,
    })
  },
}))
