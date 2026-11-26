import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceProvider } from '@/features/teach/context/WorkspaceProvider'
import { createActiveEditorRegistry } from '@/features/teach/state/active-editor-store'
import { usePlaygroundSession } from '@/features/teach/state/playground-session'
import { buildWorkspaceSnapshotBundle } from '@/features/teach/state/workspace-snapshot'
import { createAIClassroom } from '@/lib/teach/classroom/ai-classroom'
import { createBuiltInCourseContentPackCatalog } from '@/lib/teach/classroom/built-in-course'
import { createMemoryClassroomStorage } from '@/lib/teach/classroom/storage'
import { TestI18nProvider } from '@/modules/i18n/test-i18n'
import { WorkspaceDataDialog } from './WorkspaceDataDialog'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

async function setupWorkspace() {
  const catalog = createBuiltInCourseContentPackCatalog('en')
  const storage = createMemoryClassroomStorage()
  let seq = 0
  const classroom = createAIClassroom({
    catalog,
    storage,
    now: () => 1_000 + seq,
    createId: () => `id-${++seq}`,
  })
  await classroom.open()
  await classroom.execute({
    type: 'start_learning_track',
    trackId: 'track:initial',
    goal: 'Initial goal',
    conceptIds: ['cj.program.main'],
    explicitLearnerGoal: true,
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <TestI18nProvider locale="en">
      <WorkspaceProvider
        lang="en"
        classroom={classroom}
        catalog={catalog}
        knowledge={{ id: 'test', search: async () => [] }}
        runner={{ run: async () => ({ ok: true, phase: 'run', stdout: '', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 }) }}
        activeEditor={createActiveEditorRegistry()}
        now={() => 2_000}
        storage={storage}
        storageScope="classroom:current"
        courseVersion="course:sha256:test"
      >
        {children}
      </WorkspaceProvider>
    </TestI18nProvider>
  )
  return { catalog, classroom, storage, wrapper }
}

describe('workspaceDataDialog', () => {
  it('exports a JSON snapshot and invokes onBeforeExport', async () => {
    const { classroom, wrapper } = await setupWorkspace()
    const onBeforeExport = vi.fn()
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    render(
      <WorkspaceDataDialog
        open
        onOpenChange={vi.fn()}
        onBeforeExport={onBeforeExport}
      />,
      { wrapper },
    )

    fireEvent.click(screen.getByTestId('workspace-export-json'))
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledOnce())
    expect(onBeforeExport).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')
    expect(screen.getByTestId('workspace-data-feedback').textContent).toContain('exported')

    await classroom.dispose()
  })

  it('rejects invalid JSON imports without modifying classroom state and imports valid snapshots', async () => {
    const { classroom, wrapper } = await setupWorkspace()
    usePlaygroundSession.setState({ persistenceStatus: 'closed' })

    render(
      <WorkspaceDataDialog open onOpenChange={vi.fn()} />,
      { wrapper },
    )

    const input = screen.getByTestId('workspace-import-input') as HTMLInputElement
    const invalidFile = new File(['{bad json'], 'bad.json', { type: 'application/json' })
    fireEvent.change(input, { target: { files: [invalidFile] } })
    expect((await screen.findByTestId('workspace-data-feedback')).textContent).toContain('valid JSON')
    expect(classroom.snapshot().tracks[0]?.goal).toBe('Initial goal')

    const importedSnapshot = {
      ...classroom.snapshot(),
      tracks: [{
        ...classroom.snapshot().tracks[0]!,
        id: 'track:imported',
        goal: 'Imported goal',
      }],
      activeTrackId: 'track:imported',
    }
    const bundle = buildWorkspaceSnapshotBundle({
      classroomSnapshot: importedSnapshot,
      courseVersion: 'course:sha256:test',
      playgroundTabs: [],
    })
    const validFile = new File([JSON.stringify(bundle)], 'backup.json', { type: 'application/json' })
    fireEvent.change(input, { target: { files: [validFile] } })

    await waitFor(() => expect(classroom.snapshot().tracks[0]?.goal).toBe('Imported goal'))
    await classroom.dispose()
  })

  it('requires explicit confirmation before resetting the workspace', async () => {
    const { classroom, wrapper } = await setupWorkspace()
    usePlaygroundSession.setState({ persistenceStatus: 'closed' })

    render(
      <WorkspaceDataDialog open onOpenChange={vi.fn()} />,
      { wrapper },
    )

    fireEvent.click(screen.getByTestId('workspace-reset-trigger'))
    expect(classroom.snapshot().tracks).toHaveLength(1)

    await act(async () => {
      fireEvent.click(screen.getByTestId('workspace-reset-confirm'))
    })
    await waitFor(() => expect(classroom.snapshot().tracks).toHaveLength(0))
    await classroom.dispose()
  })
})
