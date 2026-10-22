import { cleanup, fireEvent, render as renderUI, screen } from '@testing-library/react'
import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TeachApp from './TeachApp'

const modules = vi.hoisted(() => ({ openRuntime: vi.fn() }))

const i18n = setupI18n({ locale: 'en', messages: { en: {} } })

function render(ui: ReactNode) {
  return renderUI(<I18nProvider i18n={i18n}>{ui}</I18nProvider>)
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
      const html = renderToString(<I18nProvider i18n={i18n}><TeachApp lang="en" /></I18nProvider>)
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
