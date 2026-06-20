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
import { createActiveEditorRegistry } from '@/features/teach/state/active-editor-store'
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
    activeEditor: createActiveEditorRegistry(),
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
  // The store is a module singleton; reset it so view state never leaks between tests.
  useWorkspaceStore.setState({ view: 'lessons', currentLessonId: null, currentReferenceId: null })
})

afterEach(() => {
  cleanup()
})

describe('teachWorkspaceShell', () => {
  it('renders three regions: nav, central viewport, and chat slot', () => {
    render(<TeachWorkspaceShell chat={<div data-testid="chat-slot" />} />, makeRepo())
    expect(screen.getByTestId('workspace-nav')).toBeTruthy()
    expect(screen.getByTestId('workspace-viewport')).toBeTruthy()
    expect(screen.getByTestId('workspace-chat')).toBeTruthy()
    expect(screen.getByTestId('chat-slot')).toBeTruthy()
  })

  it('exposes all six navigation entries', () => {
    render(<TeachWorkspaceShell chat={null} />, makeRepo())
    const nav = screen.getByTestId('workspace-nav')
    expect(nav.querySelectorAll('[data-nav-item]')).toHaveLength(6)
  })

  it('switches the central view when a nav entry is clicked', async () => {
    render(<TeachWorkspaceShell chat={null} />, makeRepo({
      mission: { topic: 'Cangjie CLI', why: 'ship a tool', successLooksLike: ['parse args'], constraints: [], outOfScope: [], updatedAt: 1 },
    }))
    // Default view is the lessons list.
    expect(await screen.findByTestId('lessons-empty')).toBeTruthy()

    fireEvent.click(screen.getByTestId('workspace-nav-mission'))
    expect(await screen.findByTestId('mission-view')).toBeTruthy()
    expect(useWorkspaceStore.getState().view).toBe('mission')
  })

  it('renders the open lesson in the central viewport for the lesson view', async () => {
    // A mission must exist for the lessons surface to be reachable (mission-first
    // gating); covered on its own in mission-first.test.tsx.
    const repo = makeRepo({
      mission: { topic: 'Cangjie CLI', why: 'ship a tool', successLooksLike: ['parse args'], constraints: [], outOfScope: [], updatedAt: 1 },
      lessons: [lesson({ id: '0007', title: 'pattern matching' })],
    })
    render(<TeachWorkspaceShell chat={null} />, repo)
    useWorkspaceStore.getState().selectLesson('0007')
    expect(await screen.findByTestId('lesson-renderer')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('let binds an immutable value')).toBeTruthy())
  })

  it('marks the active nav entry as current', () => {
    render(<TeachWorkspaceShell chat={null} />, makeRepo())
    const lessonsItem = screen.getByTestId('workspace-nav-lessons')
    expect(lessonsItem.getAttribute('aria-current')).toBe('page')
    fireEvent.click(screen.getByTestId('workspace-nav-glossary'))
    expect(screen.getByTestId('workspace-nav-glossary').getAttribute('aria-current')).toBe('page')
    expect(lessonsItem.getAttribute('aria-current')).not.toBe('page')
  })

  it('toggles the chat drawer open and closed on mobile', () => {
    render(<TeachWorkspaceShell chat={<div data-testid="chat-slot" />} />, makeRepo())
    const chat = screen.getByTestId('workspace-chat')
    // Drawer starts closed on mobile (hidden) but the desktop column always shows it.
    expect(chat.getAttribute('data-open')).toBe('false')
    fireEvent.click(screen.getByTestId('workspace-chat-toggle'))
    expect(screen.getByTestId('workspace-chat').getAttribute('data-open')).toBe('true')
    fireEvent.click(screen.getByTestId('workspace-chat-close'))
    expect(screen.getByTestId('workspace-chat').getAttribute('data-open')).toBe('false')
  })

  it('reflects the chat open/closed state on the toggle for assistive tech', () => {
    render(<TeachWorkspaceShell chat={<div data-testid="chat-slot" />} />, makeRepo())
    const toggle = screen.getByTestId('workspace-chat-toggle')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(toggle.getAttribute('aria-label')).toContain('打开')
    expect(toggle.getAttribute('aria-controls')).toBe(screen.getByTestId('workspace-chat').id)
    fireEvent.click(toggle)
    const toggled = screen.getByTestId('workspace-chat-toggle')
    expect(toggled.getAttribute('aria-expanded')).toBe('true')
    expect(toggled.getAttribute('aria-label')).toContain('收起')
  })

  it('makes the closed chat drawer inert on mobile so it leaves the tab order', () => {
    const originalWidth = window.innerWidth
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 480 })
    try {
      render(<TeachWorkspaceShell chat={<div data-testid="chat-slot" />} />, makeRepo())
      // Closed on a mobile-width viewport: inert (focus/AT skip the off-screen drawer).
      expect(screen.getByTestId('workspace-chat').hasAttribute('inert')).toBe(true)
      fireEvent.click(screen.getByTestId('workspace-chat-toggle'))
      // Opened: interactive again.
      expect(screen.getByTestId('workspace-chat').hasAttribute('inert')).toBe(false)
    }
    finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth })
    }
  })
})
