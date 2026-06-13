import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react'
import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import type { ReactElement, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Lesson } from '@/lib/teach/lessons/lesson'
import type { Mission } from '@/lib/teach/workspace/documents'
import type { WorkspaceRepository } from '@/lib/teach/workspace/repository'
import type { WorkspaceContextValue } from '@/features/teach/context/workspace-context'
import { WorkspaceContext } from '@/features/teach/context/workspace-context'
import { LessonNavigationContext, noopLessonNavigation } from '@/features/teach/context/lesson-navigation-context'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import { TeachWorkspaceShell } from './TeachWorkspaceShell'

type RepoOverrides = Partial<{
  mission: Mission | null
  lessons: Lesson[]
}>

function makeRepo(o: RepoOverrides = {}): WorkspaceRepository {
  return {
    getMission: vi.fn(async () => o.mission ?? null),
    getGlossary: vi.fn(async () => ({ terms: [] })),
    listLessons: vi.fn(async () => o.lessons ?? []),
    getLesson: vi.fn(async (id: string) => o.lessons?.find(l => l.id === id) ?? null),
    listLearningRecords: vi.fn(async () => []),
    listReferences: vi.fn(async () => []),
    getReference: vi.fn(async () => null),
    getNotes: vi.fn(async () => ({ body: '' })),
    updateLessonState: vi.fn(async () => undefined),
  } as unknown as WorkspaceRepository
}

function makeContext(repo: WorkspaceRepository): WorkspaceContextValue {
  return {
    repo,
    retrievalStore: { list: vi.fn(async () => []), save: vi.fn() },
    knowledge: { id: 'cangjie-mcp', search: vi.fn(async () => []) },
    now: () => 0,
  }
}

let currentRepo: WorkspaceRepository = makeRepo()

function Wrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  return (
    <I18nProvider i18n={i18n}>
      <WorkspaceContext value={makeContext(currentRepo)}>
        <LessonNavigationContext value={noopLessonNavigation}>{children}</LessonNavigationContext>
      </WorkspaceContext>
    </I18nProvider>
  )
}

function render(ui: ReactElement, repo: WorkspaceRepository) {
  currentRepo = repo
  return rtlRender(ui, { wrapper: Wrapper })
}

const MISSION: Mission = {
  topic: 'Cangjie CLI',
  why: 'ship a tool',
  successLooksLike: ['parse args'],
  constraints: [],
  outOfScope: [],
  updatedAt: 1,
}

function lesson(over: Partial<Lesson> = {}): Lesson {
  return {
    id: '0001',
    title: 'let vs var',
    missionLink: 'build a CLI',
    skillFocus: 'declare bindings',
    zpdRationale: 'knows nothing yet',
    blocks: [{ type: 'prose', markdown: 'let binds an immutable value' }],
    citations: [],
    state: { status: 'unstarted', blockProgress: {} },
    createdAt: 1,
    ...over,
  }
}

beforeEach(() => {
  globalI18n.load({ zh: {} })
  globalI18n.activate('zh')
  useWorkspaceStore.setState({ view: 'lessons', currentLessonId: null, currentReferenceId: null })
})

afterEach(() => {
  cleanup()
})

describe('mission-first gating', () => {
  it('shows the mission gate in the central viewport when no mission exists', async () => {
    render(<TeachWorkspaceShell chat={null} />, makeRepo({ mission: null }))
    // Default view is 'lessons'; with no mission the gate replaces the list.
    expect(await screen.findByTestId('mission-gate')).toBeTruthy()
    expect(screen.queryByTestId('lessons-list-view')).toBeNull()
    expect(screen.queryByTestId('lessons-empty')).toBeNull()
  })

  it('disables the lessons nav entry until a mission exists', async () => {
    render(<TeachWorkspaceShell chat={null} />, makeRepo({ mission: null }))
    await screen.findByTestId('mission-gate')
    const lessonsEntry = screen.getByTestId('workspace-nav-lessons')
    expect(lessonsEntry.getAttribute('disabled')).not.toBeNull()
    expect(lessonsEntry.getAttribute('aria-disabled')).toBe('true')
  })

  it('keeps the mission nav entry usable so the learner can review the gate', async () => {
    render(<TeachWorkspaceShell chat={null} />, makeRepo({ mission: null }))
    await screen.findByTestId('mission-gate')
    const missionEntry = screen.getByTestId('workspace-nav-mission')
    expect(missionEntry.getAttribute('disabled')).toBeNull()
    fireEvent.click(missionEntry)
    expect(await screen.findByTestId('mission-empty')).toBeTruthy()
  })

  it('does not switch to the lessons view when its disabled nav entry is clicked', async () => {
    render(<TeachWorkspaceShell chat={null} />, makeRepo({ mission: null }))
    await screen.findByTestId('mission-gate')
    // Move off the lessons view first so a no-op click is observable.
    fireEvent.click(screen.getByTestId('workspace-nav-glossary'))
    expect(useWorkspaceStore.getState().view).toBe('glossary')
    fireEvent.click(screen.getByTestId('workspace-nav-lessons'))
    expect(useWorkspaceStore.getState().view).toBe('glossary')
  })

  it('unlocks lessons once a mission exists', async () => {
    render(<TeachWorkspaceShell chat={null} />, makeRepo({ mission: MISSION, lessons: [lesson()] }))
    // No gate; the lessons list renders.
    expect(await screen.findByTestId('lessons-list-view')).toBeTruthy()
    expect(screen.queryByTestId('mission-gate')).toBeNull()
    const lessonsEntry = screen.getByTestId('workspace-nav-lessons')
    expect(lessonsEntry.getAttribute('disabled')).toBeNull()
    expect(lessonsEntry.getAttribute('aria-disabled')).not.toBe('true')
  })

  it('lets the learner open a lesson once a mission exists', async () => {
    const repo = makeRepo({ mission: MISSION, lessons: [lesson({ id: '0007', title: 'pattern matching' })] })
    render(<TeachWorkspaceShell chat={null} />, repo)
    await screen.findByTestId('lessons-list-view')
    useWorkspaceStore.getState().selectLesson('0007')
    expect(await screen.findByTestId('lesson-renderer')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('let binds an immutable value')).toBeTruthy())
  })
})
