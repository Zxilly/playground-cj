import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { KnowledgeSource } from '@/lib/teach/knowledge/source'
import type { EditorBridge } from '@/lib/teach/teacher/toolkit'
import type { RetrievalStoreLike } from '@/features/teach/hooks/use-block-outcome'
import type { WorkspaceRepository } from '@/lib/teach/workspace/repository'
import { useLessonNavigation } from '@/features/teach/context/useLessonNavigation'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import { useWorkspace } from './useWorkspace'
import { WorkspaceProvider } from './WorkspaceProvider'

function makeRepo(): WorkspaceRepository {
  return {
    getMission: vi.fn(),
    setMission: vi.fn(),
    listLearningRecords: vi.fn(),
    appendLearningRecord: vi.fn(),
    supersedeLearningRecord: vi.fn(),
    getGlossary: vi.fn(),
    upsertGlossaryTerm: vi.fn(),
    getNotes: vi.fn(),
    setNotes: vi.fn(),
    listLessons: vi.fn(),
    getLesson: vi.fn(),
    appendLesson: vi.fn(),
    updateLessonState: vi.fn(),
    listReferences: vi.fn(),
    getReference: vi.fn(),
    upsertReference: vi.fn(),
    exportAll: vi.fn(),
    importAll: vi.fn(),
  } as unknown as WorkspaceRepository
}

const knowledge: KnowledgeSource = { id: 'cangjie-mcp', search: vi.fn(async () => []) }
const retrievalStore: RetrievalStoreLike = { list: vi.fn(async () => []), save: vi.fn() }
const editor: EditorBridge = { setCode: vi.fn(), getCode: vi.fn(() => '') }

function makeDeps() {
  return { repo: makeRepo(), knowledge, retrievalStore, editor, now: () => 42 }
}

function wrap(deps: ReturnType<typeof makeDeps>, ui: ReactNode) {
  return render(<WorkspaceProvider {...deps}>{ui}</WorkspaceProvider>)
}

let captured: ReturnType<typeof useWorkspace> | null = null
function WorkspaceProbe() {
  captured = useWorkspace()
  return null
}

function NavProbe() {
  const nav = useLessonNavigation()
  return (
    <>
      <button type="button" data-testid="go-lesson" onClick={() => nav.selectLesson('0007')}>l</button>
      <button type="button" data-testid="go-ref" onClick={() => nav.openReference('r9')}>r</button>
      <button type="button" data-testid="ask" onClick={() => nav.prefillChat('why?')}>ask</button>
    </>
  )
}

afterEach(() => {
  cleanup()
  captured = null
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState(), true)
})

describe('workspaceProvider', () => {
  it('exposes the injected dependencies through useWorkspace', () => {
    const deps = makeDeps()
    wrap(deps, <WorkspaceProbe />)
    expect(captured!.repo).toBe(deps.repo)
    expect(captured!.knowledge).toBe(knowledge)
    expect(captured!.retrievalStore).toBe(retrievalStore)
    expect(captured!.editor).toBe(editor)
    expect(captured!.now()).toBe(42)
  })

  it('wires lesson navigation to the workspace store', () => {
    wrap(makeDeps(), <NavProbe />)

    fireEvent.click(screen.getByTestId('go-lesson'))
    expect(useWorkspaceStore.getState().view).toBe('lesson')
    expect(useWorkspaceStore.getState().currentLessonId).toBe('0007')

    fireEvent.click(screen.getByTestId('go-ref'))
    expect(useWorkspaceStore.getState().view).toBe('reference')
    expect(useWorkspaceStore.getState().currentReferenceId).toBe('r9')
  })

  it('routes prefillChat to the injected handler', () => {
    const onPrefillChat = vi.fn()
    render(
      <WorkspaceProvider {...makeDeps()} onPrefillChat={onPrefillChat}>
        <NavProbe />
      </WorkspaceProvider>,
    )
    fireEvent.click(screen.getByTestId('ask'))
    expect(onPrefillChat).toHaveBeenCalledWith('why?')
  })

  it('throws when useWorkspace is used outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<WorkspaceProbe />)).toThrow(/WorkspaceProvider/)
    spy.mockRestore()
  })
})
