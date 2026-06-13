import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react'
import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import type { ReactElement, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Lesson } from '@/lib/teach/lessons/lesson'
import type {
  Glossary,
  LearningRecord,
  Mission,
  Notes,
  ReferenceDoc,
} from '@/lib/teach/workspace/documents'
import type { WorkspaceRepository } from '@/lib/teach/workspace/repository'
import type { WorkspaceContextValue } from '@/features/teach/context/workspace-context'
import { WorkspaceContext } from '@/features/teach/context/workspace-context'
import { LessonNavigationContext, noopLessonNavigation } from '@/features/teach/context/lesson-navigation-context'
import { MissionView } from './MissionView'
import { GlossaryView } from './GlossaryView'
import { LessonsListView } from './LessonsListView'
import { RecordsView } from './RecordsView'
import { ReferenceView } from './ReferenceView'
import { NotesView } from './NotesView'

type RepoOverrides = Partial<{
  mission: Mission | null
  glossary: Glossary
  lessons: Lesson[]
  records: LearningRecord[]
  references: ReferenceDoc[]
  notes: Notes
}>

function makeRepo(o: RepoOverrides = {}): WorkspaceRepository {
  return {
    getMission: vi.fn(async () => o.mission ?? null),
    getGlossary: vi.fn(async () => o.glossary ?? { terms: [] }),
    listLessons: vi.fn(async () => o.lessons ?? []),
    listLearningRecords: vi.fn(async () => o.records ?? []),
    listReferences: vi.fn(async () => o.references ?? []),
    getReference: vi.fn(async (id: string) => o.references?.find(r => r.id === id) ?? null),
    getNotes: vi.fn(async () => o.notes ?? { body: '' }),
  } as unknown as WorkspaceRepository
}

function makeContext(repo: WorkspaceRepository): WorkspaceContextValue {
  return {
    repo,
    retrievalStore: { list: vi.fn(async () => []), save: vi.fn() },
    knowledge: { id: 'cangjie-mcp', search: vi.fn(async () => []) },
    editor: { setCode: vi.fn(), getCode: vi.fn(() => '') },
    now: () => 0,
  }
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

describe('missionView', () => {
  it('renders the mission fields when a mission exists', async () => {
    const repo = makeRepo({
      mission: {
        topic: 'Cangjie CLI',
        why: 'ship a packaging tool',
        successLooksLike: ['parse args', 'print help'],
        constraints: ['no deps'],
        outOfScope: ['GUI'],
        updatedAt: 1,
      },
    })
    render(<MissionView />, repo)
    expect(await screen.findByText('Cangjie CLI')).toBeTruthy()
    expect(screen.getByText('ship a packaging tool')).toBeTruthy()
    expect(screen.getByText('parse args')).toBeTruthy()
    expect(screen.getByText('print help')).toBeTruthy()
  })

  it('prompts to talk to the teacher when there is no mission', async () => {
    const repo = makeRepo({ mission: null })
    render(<MissionView />, repo)
    expect(await screen.findByTestId('mission-empty')).toBeTruthy()
  })
})

describe('glossaryView', () => {
  it('lists terms with their definition and avoid phrasings', async () => {
    const repo = makeRepo({
      glossary: {
        terms: [
          { term: 'binding', definition: 'a name bound to a value', avoid: ['variable'], addedAt: 1 },
        ],
      },
    })
    render(<GlossaryView />, repo)
    expect(await screen.findByText('binding')).toBeTruthy()
    expect(screen.getByText('a name bound to a value')).toBeTruthy()
    expect(screen.getByText(/variable/)).toBeTruthy()
  })

  it('shows an empty state when no terms are mastered yet', async () => {
    const repo = makeRepo({ glossary: { terms: [] } })
    render(<GlossaryView />, repo)
    expect(await screen.findByTestId('glossary-empty')).toBeTruthy()
  })
})

describe('lessonsListView', () => {
  it('lists lessons with their completion status', async () => {
    const repo = makeRepo({
      lessons: [
        lesson({ id: '0001', title: 'let vs var', state: { status: 'completed', blockProgress: {}, completedAt: 2 } }),
        lesson({ id: '0002', title: 'functions', state: { status: 'unstarted', blockProgress: {} } }),
      ],
    })
    render(<LessonsListView />, repo)
    expect(await screen.findByText('let vs var')).toBeTruthy()
    expect(screen.getByText('functions')).toBeTruthy()
    const items = screen.getAllByTestId('lesson-list-item')
    expect(items).toHaveLength(2)
    expect(items[0].getAttribute('data-status')).toBe('completed')
  })

  it('selects a lesson on click', async () => {
    const nav = { ...noopLessonNavigation, selectLesson: vi.fn() }
    const repo = makeRepo({ lessons: [lesson({ id: '0007', title: 'pattern matching' })] })
    render(<LessonsListView />, repo, nav)
    fireEvent.click(await screen.findByText('pattern matching'))
    expect(nav.selectLesson).toHaveBeenCalledWith('0007')
  })

  it('shows an empty state when there are no lessons', async () => {
    const repo = makeRepo({ lessons: [] })
    render(<LessonsListView />, repo)
    expect(await screen.findByTestId('lessons-empty')).toBeTruthy()
  })
})

describe('recordsView', () => {
  const records: LearningRecord[] = [
    { id: '0001', title: 'understands bindings', body: 'got it', status: 'active', createdAt: 1 },
    { id: '0002', title: 'old belief', body: 'corrected', status: 'superseded', supersededBy: '0001', createdAt: 2 },
  ]

  it('lists active and superseded records distinctly', async () => {
    const repo = makeRepo({ records })
    render(<RecordsView />, repo)
    expect(await screen.findByText('understands bindings')).toBeTruthy()
    const active = screen.getByTestId('record-0001')
    const superseded = screen.getByTestId('record-0002')
    expect(active.getAttribute('data-status')).toBe('active')
    expect(superseded.getAttribute('data-status')).toBe('superseded')
  })

  it('shows an empty state when there are no records', async () => {
    const repo = makeRepo({ records: [] })
    render(<RecordsView />, repo)
    expect(await screen.findByTestId('records-empty')).toBeTruthy()
  })
})

describe('referenceView', () => {
  const references: ReferenceDoc[] = [
    {
      id: 'r1',
      title: 'Syntax cheat-sheet',
      blocks: [
        { type: 'heading', level: 2, text: 'Bindings' },
        { type: 'code_sample', code: 'let x = 1', language: 'cangjie' },
      ],
      updatedAt: 1,
    },
  ]

  it('renders the selected reference document blocks', async () => {
    const repo = makeRepo({ references })
    render(<ReferenceView referenceId="r1" />, repo)
    expect(await screen.findByRole('heading', { name: 'Bindings' })).toBeTruthy()
    expect(screen.getByText(/let x = 1/)).toBeTruthy()
  })

  it('lists references to pick from when none is selected', async () => {
    const repo = makeRepo({ references })
    render(<ReferenceView referenceId={null} />, repo)
    expect(await screen.findByText('Syntax cheat-sheet')).toBeTruthy()
  })

  it('shows an empty state when there are no references', async () => {
    const repo = makeRepo({ references: [] })
    render(<ReferenceView referenceId={null} />, repo)
    expect(await screen.findByTestId('references-empty')).toBeTruthy()
  })
})

describe('notesView', () => {
  it('shows the notes body', async () => {
    const repo = makeRepo({ notes: { body: 'prefers worked examples first' } })
    render(<NotesView />, repo)
    await waitFor(() => expect(screen.getByText('prefers worked examples first')).toBeTruthy())
  })

  it('shows an empty state when notes are blank', async () => {
    const repo = makeRepo({ notes: { body: '' } })
    render(<NotesView />, repo)
    expect(await screen.findByTestId('notes-empty')).toBeTruthy()
  })
})
