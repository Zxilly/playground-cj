import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceCollaborators } from '@/features/teach/state/workspace-collaborators'
import { TeachAppContent } from './TeachApp'

/* eslint-disable react/component-hook-factories -- Vitest module factories intentionally provide component test doubles. */
vi.mock('./TeachLanding', () => ({
  TeachLanding: ({ onStart }: { onStart: () => void }) => (
    <button type="button" onClick={onStart}>landing</button>
  ),
}))
vi.mock('./TeachConfigWizard', () => ({
  TeachConfigWizard: ({ onEnter }: { onEnter: () => void }) => (
    <button type="button" onClick={onEnter}>config</button>
  ),
}))
vi.mock('./TeachWorkspace', () => ({
  TeachWorkspace: () => <div>workspace</div>,
}))
vi.mock('@/modules/llm-config/components/QuotaExhaustedDialog', () => ({
  QuotaExhaustedDialog: () => null,
}))
/* eslint-enable react/component-hook-factories */

const collaborators = {
  classroom: {
    open: vi.fn(),
    snapshot: vi.fn(),
    subscribe: vi.fn(() => () => undefined),
    execute: vi.fn(),
    dispose: vi.fn(),
  },
  catalog: {
    list: () => [],
    get: () => undefined,
    getVersion: () => undefined,
    listVersions: () => [],
    availability: () => undefined,
  },
  knowledge: { id: 'test', search: vi.fn(async () => []) },
  runner: { run: vi.fn() },
  activeEditor: {
    getCode: () => null,
    register: () => () => undefined,
  },
  now: () => 0,
  dispose: vi.fn(async () => undefined),
} as unknown as WorkspaceCollaborators

beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe('teachAppContent', () => {
  it('moves through explicit onboarding before entering the classroom', () => {
    render(<TeachAppContent lang="en" collaborators={collaborators} />)
    fireEvent.click(screen.getByRole('button', { name: 'landing' }))
    fireEvent.click(screen.getByRole('button', { name: 'config' }))
    expect(screen.getByText('workspace')).toBeTruthy()
    expect(localStorage.getItem('teach:onboarded')).toBe('1')
  })

  it('returns directly to the classroom after onboarding', () => {
    localStorage.setItem('teach:onboarded', '1')
    render(<TeachAppContent lang="zh" collaborators={collaborators} />)
    expect(screen.getByText('workspace')).toBeTruthy()
  })
})
