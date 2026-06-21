import { cleanup, fireEvent, render as rtlRender, screen } from '@testing-library/react'
import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import type { ReactElement, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Lesson } from '@/lib/teach/lessons/lesson'
import type { Glossary, LearningRecord, Mission } from '@/lib/teach/workspace/documents'
import type { RetrievalItem } from '@/lib/teach/retrieval/types'
import type { WorkspaceRepository } from '@/lib/teach/workspace/repository'
import type { WorkspaceContextValue } from '@/features/teach/context/workspace-context'
import { WorkspaceContext } from '@/features/teach/context/workspace-context'
import { LessonNavigationContext, noopLessonNavigation } from '@/features/teach/context/lesson-navigation-context'
import { createActiveEditorRegistry } from '@/features/teach/state/active-editor-store'
import { ProgressDashboardView } from './ProgressDashboardView'

type RepoOverrides = Partial<{
  mission: Mission | null
  glossary: Glossary
  lessons: Lesson[]
  records: LearningRecord[]
  retrieval: RetrievalItem[]
}>

function makeRepo(o: RepoOverrides = {}): WorkspaceRepository {
  return {
    getMission: vi.fn(async () => o.mission ?? null),
    getGlossary: vi.fn(async () => o.glossary ?? { terms: [] }),
    listLessons: vi.fn(async () => o.lessons ?? []),
    listLearningRecords: vi.fn(async () => o.records ?? []),
    listRetrieval: vi.fn(async () => o.retrieval ?? []),
  } as unknown as WorkspaceRepository
}

const NOW = 1_000_000

function makeContext(repo: WorkspaceRepository): WorkspaceContextValue {
  return {
    repo,
    retrievalStore: { list: vi.fn(async () => []), save: vi.fn() },
    knowledge: { id: 'cangjie-mcp', search: vi.fn(async () => []) },
    activeEditor: createActiveEditorRegistry(),
    now: () => NOW,
  } as unknown as WorkspaceContextValue
}

let currentRepo: WorkspaceRepository = makeRepo()
let currentNav = noopLessonNavigation

function Wrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  return (
    <I18nProvider i18n={i18n}>
      <WorkspaceContext value={makeContext(currentRepo)}>
        <LessonNavigationContext value={currentNav}>{children}</LessonNavigationContext>
      </WorkspaceContext>
    </I18nProvider>
  )
}

function render(ui: ReactElement, repo: WorkspaceRepository, nav = noopLessonNavigation) {
  currentRepo = repo
  currentNav = nav
  return rtlRender(ui, { wrapper: Wrapper })
}

beforeEach(() => {
  globalI18n.load({ zh: {} })
  globalI18n.activate('zh')
})

afterEach(() => {
  cleanup()
})

function lesson(over: Partial<Lesson> = {}): Lesson {
  return {
    id: '0001',
    title: 'let vs var',
    missionLink: 'build a CLI',
    skillFocus: 'declare bindings',
    zpdRationale: 'knows nothing yet',
    blocks: [{ type: 'prose', markdown: 'x' }],
    citations: [],
    state: { status: 'unstarted', blockProgress: {} },
    createdAt: 1,
    ...over,
  }
}

function retrievalItem(over: Partial<RetrievalItem> = {}): RetrievalItem {
  return {
    id: 'r1',
    lessonId: '0001',
    blockId: 'b1',
    kind: 'quiz',
    dueAt: 0,
    intervalDays: 1,
    ease: 2.5,
    history: [],
    ...over,
  }
}

describe('progressDashboardView', () => {
  it('shows a cold empty state when there is no mission and no lessons', async () => {
    const repo = makeRepo({ mission: null, lessons: [] })
    render(<ProgressDashboardView />, repo)
    expect(await screen.findByTestId('progress-empty')).toBeTruthy()
    expect(screen.queryByTestId('progress-dashboard')).toBeNull()
  })

  it('renders the mission topic when a mission exists', async () => {
    const repo = makeRepo({
      mission: {
        topic: 'Cangjie CLI',
        why: 'ship a packaging tool',
        successLooksLike: ['parse args'],
        constraints: [],
        outOfScope: [],
        updatedAt: 1,
      },
      lessons: [lesson()],
    })
    render(<ProgressDashboardView />, repo)
    expect(await screen.findByText('Cangjie CLI')).toBeTruthy()
  })

  it('summarises lesson counts by status', async () => {
    const repo = makeRepo({
      lessons: [
        lesson({ id: '0001', state: { status: 'completed', blockProgress: {}, completedAt: 2 } }),
        lesson({ id: '0002', state: { status: 'completed', blockProgress: {}, completedAt: 3 } }),
        lesson({ id: '0003', state: { status: 'in_progress', blockProgress: {} } }),
        lesson({ id: '0004', state: { status: 'unstarted', blockProgress: {} } }),
      ],
    })
    render(<ProgressDashboardView />, repo)
    expect((await screen.findByTestId('progress-completed')).textContent).toBe('2')
    expect(screen.getByTestId('progress-in-progress').textContent).toBe('1')
    expect(screen.getByTestId('progress-not-started').textContent).toBe('1')
    // 2 of 4 completed → progressbar at 50%.
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50')
  })

  it('counts only retrieval items due at or before now', async () => {
    const repo = makeRepo({
      lessons: [lesson()],
      retrieval: [
        retrievalItem({ id: 'r1', dueAt: NOW - 1 }), // due
        retrievalItem({ id: 'r2', dueAt: NOW }), // due (boundary)
        retrievalItem({ id: 'r3', dueAt: NOW + 1 }), // not yet due
      ],
    })
    render(<ProgressDashboardView />, repo)
    await screen.findByTestId('progress-dashboard')
    // Two items are due now; the stat card surfaces that count.
    expect(screen.getByTestId('progress-due-reviews').textContent).toBe('2')
  })

  it('counts mastered terms and active learning records', async () => {
    const repo = makeRepo({
      lessons: [lesson()],
      glossary: {
        terms: [
          { term: 'binding', definition: 'a name bound to a value', avoid: [], addedAt: 1 },
          { term: 'closure', definition: 'a captured function', avoid: [], addedAt: 2 },
        ],
      },
      records: [
        { id: 'a', title: 'understands bindings', body: 'got it', status: 'active', createdAt: 1 },
        { id: 'b', title: 'old belief', body: 'corrected', status: 'superseded', supersededBy: 'a', createdAt: 2 },
      ],
    })
    render(<ProgressDashboardView />, repo)
    await screen.findByTestId('progress-dashboard')
    // 2 mastered terms; only 1 active record (the superseded one is excluded).
    expect(screen.getByTestId('progress-terms').textContent).toBe('2')
    expect(screen.getByTestId('progress-records').textContent).toBe('1')
  })

  it('opens a lesson when a recent lesson is clicked', async () => {
    const nav = { ...noopLessonNavigation, selectLesson: vi.fn() }
    const repo = makeRepo({ lessons: [lesson({ id: '0007', title: 'pattern matching' })] })
    render(<ProgressDashboardView />, repo, nav)
    fireEvent.click(await screen.findByText('pattern matching'))
    expect(nav.selectLesson).toHaveBeenCalledWith('0007')
  })
})
