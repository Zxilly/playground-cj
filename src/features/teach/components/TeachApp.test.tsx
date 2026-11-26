import { cleanup, fireEvent, render as renderUI, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TestI18nProvider } from '@/modules/i18n/test-i18n'
import TeachApp from './TeachApp'

const modules = vi.hoisted(() => ({ openRuntime: vi.fn() }))

function render(ui: ReactNode) {
  return renderUI(<TestI18nProvider locale="en">{ui}</TestI18nProvider>)
}

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
vi.mock('./TeachAppRoot', () => {
  modules.openRuntime()
  return { default: () => <div>workspace</div> }
})

beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe('teachOnboarding', () => {
  it('renders a stable server loading state without reading browser storage', () => {
    localStorage.setItem('teach:onboarded', '1')
    const readStorage = vi.spyOn(Storage.prototype, 'getItem')
    try {
      const html = renderToString(<TestI18nProvider locale="en"><TeachApp lang="en" /></TestI18nProvider>)
      expect(html).toContain('Opening AI Classroom…')
      expect(readStorage).not.toHaveBeenCalled()
      expect(modules.openRuntime).not.toHaveBeenCalled()
    }
    finally {
      readStorage.mockRestore()
    }
  })

  it('defers loading the classroom runtime until onboarding is complete', async () => {
    render(<TeachApp lang="en" />)
    expect(modules.openRuntime).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'landing' }))
    fireEvent.click(await screen.findByRole('button', { name: 'config' }))
    expect(await screen.findByText('workspace')).toBeTruthy()
    expect(modules.openRuntime).toHaveBeenCalledOnce()
    expect(localStorage.getItem('teach:onboarded')).toBe('1')
  })

  it('returns directly to the classroom after onboarding', async () => {
    localStorage.setItem('teach:onboarded', '1')
    render(<TeachApp lang="zh" />)
    expect(await screen.findByText('workspace')).toBeTruthy()
  })
})
