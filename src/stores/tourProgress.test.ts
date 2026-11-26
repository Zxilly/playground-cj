import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildTourSectionKey,
  TOUR_DRAFTS_STORAGE_KEY,
  TOUR_PROGRESS_STORAGE_KEY,
  useTourProgressStore,
} from './tourProgress'

describe('tourProgress store', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useTourProgressStore.setState({
      hydrated: false,
      drafts: {},
      visitedSections: {},
      lastVisited: null,
    })
  })

  it('persists per-step drafts and removes them when matching starter code or cleared', () => {
    const key = buildTourSectionKey('01-welcome', '01-intro', '01')
    const store = useTourProgressStore.getState()

    expect(store.saveDraft(key, 'main() { println("edited") }', 'main() {}')).toBe(true)
    expect(useTourProgressStore.getState().drafts[key]).toBe('main() { println("edited") }')
    expect(JSON.parse(window.localStorage.getItem(TOUR_DRAFTS_STORAGE_KEY)!)).toEqual({
      [key]: 'main() { println("edited") }',
    })

    expect(store.saveDraft(key, 'main() {}', 'main() {}')).toBe(true)
    expect(useTourProgressStore.getState().drafts[key]).toBeUndefined()

    store.saveDraft(key, 'modified')
    store.clearDraft(key)
    expect(useTourProgressStore.getState().drafts[key]).toBeUndefined()
  })

  it('tracks visited sections, lastVisited, and hydrates safely from localStorage', () => {
    const key = buildTourSectionKey('02-basics', '01-vars', '02')
    useTourProgressStore.getState().markVisited({
      sectionKey: key,
      chapterId: '02-basics',
      subChapterId: '01-vars',
      sectionId: '02',
      chapterSlug: 'basics',
      chapterStep: '2',
      title: { zh: '变量', en: 'Variables' },
    })

    expect(window.localStorage.getItem(TOUR_PROGRESS_STORAGE_KEY)).toBeTruthy()

    useTourProgressStore.setState({
      hydrated: false,
      drafts: {},
      visitedSections: {},
      lastVisited: null,
    })

    const restored = useTourProgressStore.getState().hydrate()
    expect(useTourProgressStore.getState().hydrated).toBe(true)
    expect(restored.visitedSections[key]).toBe(true)
    expect(restored.lastVisited?.chapterSlug).toBe('basics')
    expect(restored.lastVisited?.chapterStep).toBe('2')
  })
})
