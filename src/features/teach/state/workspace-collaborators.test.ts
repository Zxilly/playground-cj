import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWorkspaceCollaborators } from './workspace-collaborators'

const mocks = vi.hoisted(() => ({
  storage: {
    load: vi.fn(),
    save: vi.fn(),
    close: vi.fn(),
  },
  classroom: {
    open: vi.fn(),
    dispose: vi.fn(),
  },
  catalog: { id: 'catalog' },
  createCatalog: vi.fn(),
  createClassroom: vi.fn(),
  createStorage: vi.fn(),
}))

vi.mock('@/lib/teach/classroom/built-in-course', () => ({
  createBuiltInCourseContentPackCatalog: mocks.createCatalog,
}))
vi.mock('@/lib/teach/classroom/storage', () => ({
  createIndexedDBClassroomStorage: mocks.createStorage,
}))
vi.mock('@/lib/teach/classroom/ai-classroom', () => ({
  createAIClassroom: mocks.createClassroom,
}))

async function flushMicrotasks(turns = 12): Promise<void> {
  for (let turn = 0; turn < turns; turn += 1)
    await Promise.resolve()
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createCatalog.mockReturnValue(mocks.catalog)
  mocks.createStorage.mockReturnValue(mocks.storage)
  mocks.createClassroom.mockReturnValue(mocks.classroom)
  mocks.storage.close.mockResolvedValue(undefined)
  mocks.classroom.open.mockResolvedValue({ revision: 0 })
  mocks.classroom.dispose.mockResolvedValue(undefined)
})

describe('workspace collaborator ownership', () => {
  it('uses the built-in bilingual catalog for the selected locale', async () => {
    const collaborators = await createWorkspaceCollaborators('en')

    expect(mocks.createCatalog).toHaveBeenCalledWith('en')
    expect(mocks.createStorage).toHaveBeenCalledWith({ scope: 'classroom' })
    expect(mocks.createClassroom).toHaveBeenCalledWith(expect.objectContaining({
      catalog: mocks.catalog,
      storage: mocks.storage,
    }))
    expect(mocks.classroom.open).toHaveBeenCalledOnce()

    await collaborators.dispose()
    expect(mocks.classroom.dispose).toHaveBeenCalledOnce()
    expect(mocks.storage.close).toHaveBeenCalledOnce()
  })

  it('selects locale without creating separate persistence scopes', async () => {
    const english = await createWorkspaceCollaborators('en')
    await english.dispose()
    const chinese = await createWorkspaceCollaborators('zh')

    expect(mocks.createCatalog).toHaveBeenNthCalledWith(1, 'en')
    expect(mocks.createCatalog).toHaveBeenNthCalledWith(2, 'zh')
    expect(mocks.createStorage).toHaveBeenNthCalledWith(1, { scope: 'classroom' })
    expect(mocks.createStorage).toHaveBeenNthCalledWith(2, { scope: 'classroom' })

    await chinese.dispose()
  })

  it('releases the lease after built-in catalog construction fails', async () => {
    const setupError = new Error('invalid built-in curriculum')
    mocks.createCatalog.mockImplementationOnce(() => {
      throw setupError
    })

    await expect(createWorkspaceCollaborators('en')).rejects.toBe(setupError)
    expect(mocks.createStorage).not.toHaveBeenCalled()

    const collaborators = await createWorkspaceCollaborators('zh')
    expect(mocks.createStorage).toHaveBeenCalledOnce()
    await collaborators.dispose()
  })

  it('closes classroom state storage when aggregate open fails', async () => {
    const unavailable = new Error('classroom state unavailable')
    mocks.classroom.open.mockRejectedValueOnce(unavailable)

    await expect(createWorkspaceCollaborators('en')).rejects.toBe(unavailable)
    expect(mocks.classroom.dispose).toHaveBeenCalledOnce()
    expect(mocks.storage.close).toHaveBeenCalledOnce()
  })

  it('reports aggregate and storage release failures together', async () => {
    const collaborators = await createWorkspaceCollaborators('en')
    const drainError = new Error('classroom drain failed')
    const storageError = new Error('storage close failed')
    mocks.classroom.dispose.mockRejectedValueOnce(drainError)
    mocks.storage.close.mockRejectedValueOnce(storageError)

    const failure = await collaborators.dispose().catch(error => error)
    expect(failure).toBeInstanceOf(AggregateError)
    expect((failure as AggregateError).errors).toEqual([
      drainError,
      storageError,
    ])
  })

  it('drains the classroom before closing storage and disposes idempotently', async () => {
    let releaseClassroom!: () => void
    mocks.classroom.dispose.mockReturnValueOnce(new Promise<void>((resolve) => {
      releaseClassroom = resolve
    }))
    const collaborators = await createWorkspaceCollaborators('en')

    const firstDisposal = collaborators.dispose()
    const secondDisposal = collaborators.dispose()
    expect(secondDisposal).toBe(firstDisposal)
    await Promise.resolve()

    expect(mocks.classroom.dispose).toHaveBeenCalledOnce()
    expect(mocks.storage.close).not.toHaveBeenCalled()

    releaseClassroom()
    await expect(firstDisposal).resolves.toBeUndefined()
    expect(mocks.storage.close).toHaveBeenCalledOnce()
  })

  it('does not open the next locale until the current classroom releases its lease', async () => {
    let releaseFirst!: () => void
    const firstClassroom = {
      open: vi.fn().mockResolvedValue({ revision: 0 }),
      dispose: vi.fn().mockReturnValue(new Promise<void>((resolve) => {
        releaseFirst = resolve
      })),
    }
    const secondClassroom = {
      open: vi.fn().mockResolvedValue({ revision: 0 }),
      dispose: vi.fn().mockResolvedValue(undefined),
    }
    mocks.createClassroom
      .mockReturnValueOnce(firstClassroom)
      .mockReturnValueOnce(secondClassroom)

    const english = await createWorkspaceCollaborators('en')
    const disposingEnglish = english.dispose()
    const creatingChinese = createWorkspaceCollaborators('zh')
    await Promise.resolve()

    expect(mocks.createStorage).toHaveBeenCalledOnce()
    expect(secondClassroom.open).not.toHaveBeenCalled()

    releaseFirst()
    await disposingEnglish
    const chinese = await creatingChinese
    expect(mocks.createStorage).toHaveBeenCalledTimes(2)
    expect(secondClassroom.open).toHaveBeenCalledOnce()
    await chinese.dispose()
  })

  it('removes an aborted waiting reservation from the FIFO lease', async () => {
    const english = await createWorkspaceCollaborators('en')
    const controller = new AbortController()
    const aborted = createWorkspaceCollaborators('zh', {
      signal: controller.signal,
    })
    controller.abort()
    await expect(aborted).rejects.toMatchObject({ name: 'AbortError' })

    const creatingNext = createWorkspaceCollaborators('zh')
    await Promise.resolve()
    expect(mocks.createStorage).toHaveBeenCalledOnce()

    await english.dispose()
    const next = await creatingNext
    expect(mocks.createStorage).toHaveBeenCalledTimes(2)
    await next.dispose()
  })

  it('retains ownership until late aggregate open and disposal both settle', async () => {
    vi.useFakeTimers()
    try {
      let releaseOpen!: (value: { revision: number }) => void
      let releaseDisposal!: () => void
      mocks.classroom.open.mockReturnValueOnce(new Promise((resolve) => {
        releaseOpen = resolve
      }))
      mocks.classroom.dispose.mockReturnValueOnce(new Promise<void>((resolve) => {
        releaseDisposal = resolve
      }))
      const failure = createWorkspaceCollaborators('en', { timeoutMs: 35 })
        .catch(error => error)
      await vi.advanceTimersByTimeAsync(35)

      await expect(failure).resolves.toMatchObject({ name: 'TimeoutError' })
      expect(mocks.classroom.dispose).toHaveBeenCalledOnce()
      expect(mocks.storage.close).toHaveBeenCalledOnce()

      mocks.createClassroom.mockReturnValue({
        open: vi.fn().mockResolvedValue({ revision: 0 }),
        dispose: vi.fn().mockResolvedValue(undefined),
      })
      const creatingNext = createWorkspaceCollaborators('zh', {
        timeoutMs: 100,
      })
      await vi.advanceTimersByTimeAsync(0)
      await flushMicrotasks()
      expect(mocks.createStorage).toHaveBeenCalledOnce()

      releaseOpen({ revision: 0 })
      releaseDisposal()
      await vi.advanceTimersByTimeAsync(0)
      const next = await creatingNext
      expect(mocks.createStorage).toHaveBeenCalledTimes(2)
      await next.dispose()
    }
    finally {
      vi.useRealTimers()
    }
  })
})
