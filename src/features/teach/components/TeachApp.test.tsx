import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react'
import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import type { ReactElement, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceRepository } from '@/lib/teach/workspace/repository'
import type { WorkspaceSnapshot } from '@/lib/teach/workspace/documents'
import { WORKSPACE_SNAPSHOT_VERSION } from '@/lib/teach/workspace/documents'
import type { WorkspaceCollaborators } from './TeachApp'
import { TeachAppContent } from './TeachApp'

function MockTeacherChatRuntime({ lang }: { lang: string }) {
  return <div data-testid="teacher-chat" data-lang={lang} />
}

// The chat runtime pulls in the AI SDK + assistant-ui; stub it so the app shell
// stays the unit under test.
vi.mock('./TeacherChatRuntime', () => ({
  TeacherChatRuntime: MockTeacherChatRuntime,
}))

function emptySnapshot(): WorkspaceSnapshot {
  return {
    version: WORKSPACE_SNAPSHOT_VERSION,
    mission: null,
    learningRecords: [],
    glossary: { terms: [] },
    lessons: [],
    references: [],
    notes: { body: '' },
    retrieval: [],
  }
}

interface RepoOverrides {
  getMission?: () => Promise<unknown>
  exportAll?: () => Promise<WorkspaceSnapshot>
  importAll?: (snap: WorkspaceSnapshot) => Promise<void>
}

function makeRepo(o: RepoOverrides = {}): WorkspaceRepository {
  return {
    getMission: o.getMission ?? vi.fn(async () => null),
    getGlossary: vi.fn(async () => ({ terms: [] })),
    listLessons: vi.fn(async () => []),
    getLesson: vi.fn(async () => null),
    listLearningRecords: vi.fn(async () => []),
    listReferences: vi.fn(async () => []),
    getReference: vi.fn(async () => null),
    getNotes: vi.fn(async () => ({ body: '' })),
    updateLessonState: vi.fn(async () => undefined),
    exportAll: o.exportAll ?? vi.fn(async () => emptySnapshot()),
    importAll: o.importAll ?? vi.fn(async () => undefined),
  } as unknown as WorkspaceRepository
}

function makeCollaborators(repo: WorkspaceRepository): WorkspaceCollaborators {
  return {
    repo,
    retrievalStore: { list: vi.fn(async () => []), save: vi.fn(async () => undefined) },
    knowledge: { id: 'cangjie-mcp', search: vi.fn(async () => []) },
    editor: { setCode: vi.fn(), getCode: vi.fn(() => '') },
    runner: { run: vi.fn(async () => ({ ok: true, stdout: '', stderr: '', exitCode: 0 })) },
    now: () => 0,
  }
}

function Wrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: Wrapper })
}

beforeEach(() => {
  globalI18n.load({ zh: {} })
  globalI18n.activate('zh')
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('teachAppContent', () => {
  it('mounts the workspace shell and the teacher chat after hydration', async () => {
    render(<TeachAppContent lang="zh" collaborators={makeCollaborators(makeRepo())} />)
    expect(await screen.findByTestId('teach-workspace-shell')).toBeTruthy()
    expect(screen.getByTestId('teacher-chat').getAttribute('data-lang')).toBe('zh')
  })

  it('exports the workspace snapshot as a downloaded JSON file', async () => {
    const snapshot = emptySnapshot()
    const exportAll = vi.fn(async () => snapshot)
    const repo = makeRepo({ exportAll })
    const clickSpy = vi.fn()
    const createObjectURL = vi.fn(() => 'blob:teach')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clickSpy)

    render(<TeachAppContent lang="zh" collaborators={makeCollaborators(repo)} />)
    await screen.findByTestId('teach-workspace-shell')

    fireEvent.click(screen.getByTestId('workspace-export'))
    await waitFor(() => expect(exportAll).toHaveBeenCalled())
    expect(createObjectURL).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
  })

  it('imports a workspace snapshot from a selected JSON file', async () => {
    const importAll = vi.fn(async () => undefined)
    const repo = makeRepo({ importAll })
    render(<TeachAppContent lang="zh" collaborators={makeCollaborators(repo)} />)
    await screen.findByTestId('teach-workspace-shell')

    const input = screen.getByTestId('workspace-import-input') as HTMLInputElement
    const file = new File([JSON.stringify(emptySnapshot())], 'workspace.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', { value: async () => JSON.stringify(emptySnapshot()) })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(importAll).toHaveBeenCalledWith(expect.objectContaining({ version: WORKSPACE_SNAPSHOT_VERSION })))
  })

  it('shows a recovery UI when hydration fails', async () => {
    const getMission = vi.fn(async (): Promise<unknown> => {
      throw new Error('idb blocked')
    })
    const repo = makeRepo({ getMission })
    render(<TeachAppContent lang="zh" collaborators={makeCollaborators(repo)} />)
    expect(await screen.findByTestId('teach-hydration-error')).toBeTruthy()
    expect(screen.queryByTestId('teach-workspace-shell')).toBeNull()
  })
})
