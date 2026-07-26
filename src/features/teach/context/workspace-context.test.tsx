import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { WorkspaceContextValue } from './workspace-context'
import { WorkspaceProvider } from './WorkspaceProvider'
import { useWorkspace } from './useWorkspace'

const value: WorkspaceContextValue = {
  lang: 'en',
  classroom: {
    open: async () => { throw new Error('not used') },
    snapshot: () => { throw new Error('not used') },
    subscribe: () => () => undefined,
    execute: async () => { throw new Error('not used') },
    dispose: async () => undefined,
  },
  catalog: {
    list: () => [],
    get: () => undefined,
    getVersion: () => undefined,
    listVersions: () => [],
    availability: () => undefined,
    requireValidated: () => { throw new Error('not used') },
    requireValidatedVersion: () => { throw new Error('not used') },
    requireTemplate: () => { throw new Error('not used') },
  },
  knowledge: { id: 'test', search: async () => [] },
  runner: { run: async () => ({ ok: true, phase: 'run', stdout: '', stdoutTruncated: false, stderr: '', stderrTruncated: false, compilerOutput: '', compilerOutputTruncated: false, exitCode: 0 }) },
  activeEditor: {
    getCode: () => null,
    register: () => () => undefined,
  },
  now: () => 123,
}

function Probe() {
  const workspace = useWorkspace()
  return (
    <output>
      {`${workspace.lang}:${workspace.now()}:${workspace.knowledge.id}`}
    </output>
  )
}

describe('workspace provider', () => {
  it('injects the single AI Classroom runtime without repository mirrors', () => {
    render(
      <WorkspaceProvider {...value}>
        <Probe />
      </WorkspaceProvider>,
    )
    expect(screen.getByText('en:123:test')).toBeTruthy()
  })
})
