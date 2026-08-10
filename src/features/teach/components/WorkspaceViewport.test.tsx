import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceProvider } from '@/features/teach/context/WorkspaceProvider'
import { createActiveEditorRegistry } from '@/features/teach/state/active-editor-store'
import type { WorkspaceView } from '@/features/teach/state/workspace-store'
import { createAIClassroom } from '@/lib/teach/classroom/ai-classroom'
import { createContentPackCatalog } from '@/lib/teach/classroom/content-catalog'
import { createMemoryClassroomStorage } from '@/lib/teach/classroom/storage'
import { WorkspaceViewport } from './WorkspaceViewport'

function MockConceptProgressView() {
  return <main>progress view</main>
}

function MockLiveClassroomView() {
  return <main>live view</main>
}

function MockPlaygroundView() {
  return <main>playground view</main>
}

function MockReviewView() {
  return <main>review view</main>
}

vi.mock('./views/ConceptProgressView', () => ({
  ConceptProgressView: MockConceptProgressView,
}))
vi.mock('./views/LiveClassroomView', () => ({
  LiveClassroomView: MockLiveClassroomView,
}))
vi.mock('./views/PlaygroundView', () => ({
  PlaygroundView: MockPlaygroundView,
}))
vi.mock('./views/ReviewView', () => ({
  ReviewView: MockReviewView,
}))

async function setup(lang: 'zh' | 'en') {
  const catalog = createContentPackCatalog([])
  let sequence = 0
  const classroom = createAIClassroom({
    catalog,
    storage: createMemoryClassroomStorage(),
    now: () => 1_000 + sequence,
    createId: () => `generated-${++sequence}`,
  })
  await classroom.open()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <WorkspaceProvider
      lang={lang}
      classroom={classroom}
      catalog={catalog}
      knowledge={{ id: 'test', search: async () => [] }}
      runner={{ run: async () => ({ ok: true, phase: 'run', stdout: '', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 }) }}
      activeEditor={createActiveEditorRegistry()}
      now={() => 2_000}
    >
      {children}
    </WorkspaceProvider>
  )
  return { classroom, wrapper }
}

afterEach(cleanup)

describe('workspace viewport teacher exposure disclosure', () => {
  it('does not claim teacher guidance before any teacher output is exposed', async () => {
    const { classroom, wrapper } = await setup('en')

    render(<WorkspaceViewport view="live" />, { wrapper })

    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByText('live view')).toBeTruthy()
    classroom.dispose()
  })

  it('shows the global teacher-guidance boundary above every main workspace view', async () => {
    const { classroom, wrapper } = await setup('en')
    await classroom.execute({
      type: 'record_teacher_exposure',
      interactionId: 'teacher:visible-output',
    })

    const views: WorkspaceView[] = ['live', 'review', 'progress', 'playground']
    const rendered = render(<WorkspaceViewport view={views[0]} />, { wrapper })

    for (const view of views) {
      rendered.rerender(<WorkspaceViewport view={view} />)
      expect(screen.getByRole('status').textContent).toBe(
        'You have viewed teacher explanations or guidance. Later answers are still useful for practice and feedback, but they are not treated as an independent check in this workspace.',
      )
      expect(screen.getByRole('status').nextElementSibling?.textContent).toBe(`${view} view`)
    }

    classroom.dispose()
  })

  it('states the same evidence limitation in Chinese', async () => {
    const { classroom, wrapper } = await setup('zh')
    await classroom.execute({
      type: 'record_teacher_exposure',
      interactionId: 'teacher:visible-output',
    })

    render(<WorkspaceViewport view="progress" />, { wrapper })

    expect(screen.getByRole('status').textContent).toBe(
      '你已查看老师讲解或指导。之后的作答仍可用于练习和反馈，但在这个工作区内不会被视为独立测验。',
    )
    classroom.dispose()
  })
})
