import { cleanup, fireEvent, render as rtlRender, screen } from '@testing-library/react'
import { i18n as globalI18n, setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import type { ReactElement, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { KnowledgeSource } from '@/lib/teach/knowledge/source'
import type { RetrievalStoreLike } from '@/features/teach/hooks/use-block-outcome'
import type { WorkspaceRepository } from '@/lib/teach/workspace/repository'
import { WorkspaceProvider } from '@/features/teach/context/WorkspaceProvider'
import { useWorkspaceStore } from '@/features/teach/state/workspace-store'
import { createActiveEditorRegistry } from '@/features/teach/state/active-editor-store'
import { MissionGate } from './MissionGate'

function makeRepo(): WorkspaceRepository {
  return {
    getMission: vi.fn(),
    setMission: vi.fn(),
    exportAll: vi.fn(),
    importAll: vi.fn(),
  } as unknown as WorkspaceRepository
}

const knowledge: KnowledgeSource = { id: 'cangjie-mcp', search: vi.fn(async () => []) }
const retrievalStore: RetrievalStoreLike = { list: vi.fn(async () => []), save: vi.fn() }
const activeEditor = createActiveEditorRegistry()

function Wrapper({ children }: { children: ReactNode }) {
  const i18n = setupI18n({ locale: 'zh', messages: { zh: {} } })
  i18n.activate('zh')
  return (
    <I18nProvider i18n={i18n}>
      <WorkspaceProvider repo={makeRepo()} knowledge={knowledge} retrievalStore={retrievalStore} activeEditor={activeEditor} now={() => 0}>
        {children}
      </WorkspaceProvider>
    </I18nProvider>
  )
}

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: Wrapper })
}

beforeEach(() => {
  globalI18n.load({ zh: {} })
  globalI18n.activate('zh')
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState(), true)
})

afterEach(() => {
  cleanup()
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState(), true)
})

describe('missionGate', () => {
  it('renders the mission-first guidance', () => {
    render(<MissionGate />)
    expect(screen.getByTestId('mission-gate')).toBeTruthy()
  })

  it('queues a chat prefill prompt through the workspace store when the start button is clicked', () => {
    render(<MissionGate />)
    expect(useWorkspaceStore.getState().pendingPrefill).toBeNull()
    fireEvent.click(screen.getByTestId('mission-gate-start'))
    expect(useWorkspaceStore.getState().pendingPrefill).toBe('我想学习仓颉，请帮我一起确定学习目标。')
  })
})
