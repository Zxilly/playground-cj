import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ preload: vi.fn(), mark: vi.fn() }))
vi.mock('./preload-services', () => ({ preloadEditorServices: mocks.preload }))
vi.mock('./startup-timing', () => ({ markEditorStartup: mocks.mark }))

describe('editor runtime loading', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.preload.mockResolvedValue(undefined)
  })

  it('waits for Chinese localization before importing the editor or services', async () => {
    let finishLocale!: () => void
    vi.doMock('./localization', () => new Promise<Record<string, never>>((resolve) => {
      finishLocale = () => resolve({})
    }))
    const { loadEditorRuntime } = await import('./load-editor-runtime')
    const load = vi.fn().mockResolvedValue('editor')
    const pending = loadEditorRuntime('zh', load)
    await vi.waitFor(() => expect(finishLocale).toBeDefined())
    expect(load).not.toHaveBeenCalled()
    expect(mocks.preload).not.toHaveBeenCalled()
    finishLocale()
    await expect(pending).resolves.toBe('editor')
    expect(mocks.preload).toHaveBeenCalledOnce()
  })

  it('starts English editor and services together without waiting for either one', async () => {
    const { loadEditorRuntime } = await import('./load-editor-runtime')
    let finishEditor!: (value: string) => void
    const load = vi.fn(() => new Promise<string>((resolve) => {
      finishEditor = resolve
    }))
    const pending = loadEditorRuntime('en', load)
    expect(load).toHaveBeenCalledOnce()
    expect(mocks.preload).toHaveBeenCalledOnce()
    finishEditor('editor')
    await expect(pending).resolves.toBe('editor')
  })
})
