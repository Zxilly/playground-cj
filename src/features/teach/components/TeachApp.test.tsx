import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react'
import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import type { ReactElement, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceRepository } from '@/lib/teach/workspace/repository'
import type { WorkspaceSnapshot } from '@/lib/teach/workspace/documents'
import { WORKSPACE_SNAPSHOT_VERSION } from '@/lib/teach/workspace/documents'
import { useLLMConfigStore } from '@/stores/llmConfig'
import { createActiveEditorRegistry } from '@/features/teach/state/active-editor-store'
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

// The landing gate runs the LLM config bootstrap (network + store writes); stub
// it so the app's hydration/enter flow is the unit under test.
vi.mock('@/modules/llm-config/runtime/useLLMConfigBootstrap', () => ({
  useLLMConfigBootstrap: vi.fn(() => ({ status: 'ready' as const })),
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
    runner: { run: vi.fn(async () => ({ ok: true, stdout: '', stderr: '', exitCode: 0 })) },
    activeEditor: createActiveEditorRegistry(),
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

/** Seed a complete user API key so the landing gate enables "进入工作区". */
function seedReadyConfig() {
  useLLMConfigStore.getState().setConfig({
    provider: 'openai-compatible',
    baseURL: 'https://api.example.test/v1',
    apiKey: 'test-key',
    model: 'test-model',
  })
}

/**
 * Render the app, wait past hydration to the landing gate, then click into the
 * workspace shell. Returns once the shell is mounted.
 */
async function enterWorkspace(ui: ReactElement) {
  const result = render(ui)
  // landing → config wizard
  fireEvent.click(await screen.findByTestId('teach-landing-start'))
  // A user key is seeded, so the wizard opens on the custom source: advance to
  // the credentials step (the seeded config is complete) and enter.
  fireEvent.click(await screen.findByTestId('teach-source-next'))
  fireEvent.click(await screen.findByTestId('teach-config-enter'))
  await screen.findByTestId('teach-workspace-shell')
  return result
}

beforeEach(() => {
  globalI18n.load({ zh: {} })
  globalI18n.activate('zh')
  seedReadyConfig()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  useLLMConfigStore.getState().reset()
})

describe('teachAppContent', () => {
  it('shows the landing gate (not the shell) after hydration before entering', async () => {
    render(<TeachAppContent lang="zh" collaborators={makeCollaborators(makeRepo())} />)
    expect(await screen.findByTestId('teach-landing')).toBeTruthy()
    expect(screen.queryByTestId('teach-workspace-shell')).toBeNull()
  })

  it('mounts the workspace shell and the teacher chat after entering from the landing', async () => {
    await enterWorkspace(<TeachAppContent lang="zh" collaborators={makeCollaborators(makeRepo())} />)
    expect(screen.getByTestId('teacher-chat').getAttribute('data-lang')).toBe('zh')
    // The landing gate is gone once entered.
    expect(screen.queryByTestId('teach-landing')).toBeNull()
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

    await enterWorkspace(<TeachAppContent lang="zh" collaborators={makeCollaborators(repo)} />)

    fireEvent.click(screen.getByTestId('workspace-export'))
    await waitFor(() => expect(exportAll).toHaveBeenCalled())
    expect(createObjectURL).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
  })

  it('surfaces an export failure instead of leaking an unhandled rejection', async () => {
    const exportAll = vi.fn(async (): Promise<WorkspaceSnapshot> => {
      throw new Error('storage read failed')
    })
    const repo = makeRepo({ exportAll })
    await enterWorkspace(<TeachAppContent lang="zh" collaborators={makeCollaborators(repo)} />)

    fireEvent.click(screen.getByTestId('workspace-export'))
    const banner = await screen.findByTestId('workspace-export-error')
    expect(banner.textContent).toContain('storage read failed')
  })

  it('imports a workspace snapshot from a selected JSON file', async () => {
    const importAll = vi.fn(async () => undefined)
    const repo = makeRepo({ importAll })
    await enterWorkspace(<TeachAppContent lang="zh" collaborators={makeCollaborators(repo)} />)

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
    expect(screen.queryByTestId('teach-landing')).toBeNull()
  })
})
